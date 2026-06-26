#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSFER_MD = 'C:/Users/akaza/Downloads/CROCUS_TRANSFER_FULL.md';
const API_VERSION = 'v22';
const APPLY = process.env.SEARCH_RESCUE_APPLY === 'true';

const CAMPAIGNS = {
  wimpern: '23833211183',
  pedikuere: '23873203584',
  manikuere: '23878434401',
};

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const TARGET_BIDS = [
  // Manicure: regain rank on booking/local-intent terms, not generic nail browsing.
  bid(CAMPAIGNS.manikuere, 'maniküre göppingen', 'EXACT', 0.50),
  bid(CAMPAIGNS.manikuere, 'maniküre termin göppingen', 'EXACT', 0.50),
  bid(CAMPAIGNS.manikuere, 'nagelstudio göppingen', 'EXACT', 0.50),
  bid(CAMPAIGNS.manikuere, 'russische maniküre göppingen', 'EXACT', 0.50),
  bid(CAMPAIGNS.manikuere, 'gelnägel göppingen', 'EXACT', 0.50),

  // Pedicure: exact local terms need more rank; podology/fuss terms stay conservative.
  bid(CAMPAIGNS.pedikuere, 'pediküre göppingen', 'EXACT', 0.50),
  bid(CAMPAIGNS.pedikuere, 'pediküre termin göppingen', 'EXACT', 0.50),
  bid(CAMPAIGNS.pedikuere, 'pediküre in der nähe', 'PHRASE', 0.50),

  // Wimpern: keep alive, but avoid broad far-city leakage.
  bid(CAMPAIGNS.wimpern, 'wimpern göppingen', 'EXACT', 0.50),
  bid(CAMPAIGNS.wimpern, 'wimpern termin', 'PHRASE', 0.50),
  bid(CAMPAIGNS.wimpern, 'wimpernverlängerung', 'EXACT', 0.50),
  bid(CAMPAIGNS.wimpern, 'wimpernverlängerung', 'PHRASE', 0.50),
  bid(CAMPAIGNS.wimpern, 'lash extensions', 'PHRASE', 0.50),
];

const CITY_NEGATIVES = [
  'reutlingen',
  'schwäbisch hall',
  'schwaebisch hall',
  'schwäbisch',
  'aalen',
  'ulm',
  'heilbronn',
  'esslingen',
  'tübingen',
  'tuebingen',
  'korean',
];

main().catch((error) => {
  console.error(`[search-rescue] ${error.message}`);
  process.exit(1);
});

async function main() {
  const env = readGoogleEnv();
  const token = await googleAccessToken(env);
  const ids = Object.values(CAMPAIGNS).join(',');
  const [keywords, negatives, before] = await Promise.all([
    q(env, token, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_criterion.resource_name, ad_group_criterion.status,
        ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
        ad_group_criterion.effective_cpc_bid_micros,
        ad_group_criterion.cpc_bid_micros
      FROM keyword_view
      WHERE campaign.id IN (${ids})
        AND ad_group_criterion.status IN (ENABLED, PAUSED)
    `),
    q(env, token, `
      SELECT campaign.id, campaign.name, campaign_criterion.resource_name,
        campaign_criterion.negative,
        campaign_criterion.keyword.text,
        campaign_criterion.keyword.match_type
      FROM campaign_criterion
      WHERE campaign.id IN (${ids})
        AND campaign_criterion.negative = true
    `),
    currentCampaigns(env, token, ids),
  ]);

  const plan = buildPlan(env, keywords, negatives);
  const mutations = APPLY ? await execute(env, token, plan) : dryRun(plan);
  const after = await currentCampaigns(env, token, ids);
  const report = {
    generated_at: new Date().toISOString(),
    apply: APPLY,
    reason: 'Restore Search delivery after over-strict 0.45 cap: raise only local high-intent keywords and block far-city leakage.',
    before,
    plan_counts: {
      keyword_updates: plan.keywordOps.length,
      negative_creates: plan.negativeOps.length,
    },
    plan,
    mutations,
    after,
  };
  const reportPath = path.join(REPORT_DIR, `search-delivery-rescue-${stamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: APPLY,
    report: path.relative(ROOT, reportPath),
    plan_counts: report.plan_counts,
    after,
  }, null, 2));
}

function buildPlan(env, keywords, negatives) {
  const keywordIndex = new Map();
  for (const row of keywords) {
    const criterion = row.adGroupCriterion || {};
    const key = keyFor(row.campaign?.id, criterion.keyword?.text, criterion.keyword?.matchType);
    if (!keywordIndex.has(key)) keywordIndex.set(key, []);
    keywordIndex.get(key).push(row);
  }

  const keywordOps = [];
  const plannedKeywordUpdates = [];
  for (const target of TARGET_BIDS) {
    const matches = keywordIndex.get(keyFor(target.campaignId, target.text, target.matchType)) || [];
    for (const row of matches) {
      const criterion = row.adGroupCriterion;
      const currentBid = eur(criterion.cpcBidMicros || criterion.effectiveCpcBidMicros);
      const update = { resourceName: criterion.resourceName };
      const masks = [];
      if (criterion.status !== 'ENABLED') {
        update.status = 'ENABLED';
        masks.push('status');
      }
      if (currentBid + 0.01 < target.bidEur) {
        update.cpcBidMicros = String(Math.round(target.bidEur * 1_000_000));
        masks.push('cpc_bid_micros');
      }
      if (masks.length) {
        keywordOps.push({ update, updateMask: masks.join(',') });
        plannedKeywordUpdates.push({
          campaign: clean(row.campaign?.name),
          ad_group: clean(row.adGroup?.name),
          text: target.text,
          match_type: target.matchType,
          current_bid_eur: currentBid,
          target_bid_eur: target.bidEur,
        });
      }
    }
  }

  const negativeSet = new Set(negatives.map((row) => keyFor(row.campaign?.id, row.campaignCriterion?.keyword?.text, row.campaignCriterion?.keyword?.matchType)));
  const negativeOps = [];
  const plannedNegatives = [];
  for (const campaignId of Object.values(CAMPAIGNS)) {
    for (const text of CITY_NEGATIVES) {
      const matchType = 'BROAD';
      const key = keyFor(campaignId, text, matchType);
      if (negativeSet.has(key)) continue;
      negativeOps.push({
        create: {
          campaign: `customers/${env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '')}/campaigns/${campaignId}`,
          negative: true,
          keyword: { text, matchType },
        },
      });
      plannedNegatives.push({ campaign_id: campaignId, text, match_type: matchType });
    }
  }

  return {
    keywordOps: dedupe(keywordOps, (op) => op.update.resourceName),
    negativeOps: dedupe(negativeOps, (op) => `${op.create.campaign}:${op.create.keyword.text}:${op.create.keyword.matchType}`),
    plannedKeywordUpdates,
    plannedNegatives,
  };
}

async function execute(env, token, plan) {
  return {
    keyword_updates: await mutate(env, token, 'adGroupCriteria', plan.keywordOps),
    negative_creates: await mutate(env, token, 'campaignCriteria', plan.negativeOps),
  };
}

function dryRun(plan) {
  return {
    keyword_updates: { ok: true, skipped: 'dry_run', planned: plan.keywordOps.length },
    negative_creates: { ok: true, skipped: 'dry_run', planned: plan.negativeOps.length },
  };
}

async function currentCampaigns(env, token, ids) {
  const rows = await q(env, token, `
    SELECT campaign.id, campaign.name, campaign.primary_status, campaign.primary_status_reasons,
      campaign.bidding_strategy_type, campaign.manual_cpc.enhanced_cpc_enabled,
      campaign_budget.amount_micros,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
      metrics.search_impression_share,
      metrics.search_rank_lost_impression_share,
      metrics.search_budget_lost_impression_share
    FROM campaign
    WHERE campaign.id IN (${ids})
      AND segments.date DURING TODAY
  `);
  return rows.map((row) => ({
    campaign: clean(row.campaign?.name),
    status: row.campaign?.primaryStatus,
    reasons: row.campaign?.primaryStatusReasons || [],
    strategy: row.campaign?.biddingStrategyType,
    enhanced_cpc: row.campaign?.manualCpc?.enhancedCpcEnabled ?? null,
    budget_eur: eur(row.campaignBudget?.amountMicros),
    impressions: num(row.metrics?.impressions),
    clicks: num(row.metrics?.clicks),
    cost_eur: eur(row.metrics?.costMicros),
    avg_cpc_eur: avgCpc(row.metrics),
    impression_share: pct(row.metrics?.searchImpressionShare),
    rank_lost: pct(row.metrics?.searchRankLostImpressionShare),
    budget_lost: pct(row.metrics?.searchBudgetLostImpressionShare),
  }));
}

async function q(env, token, query) {
  const customerId = env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: headers(env, token),
    body: JSON.stringify({ query: query.replace(/\s+/g, ' ').trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data.flatMap((chunk) => chunk.results || []);
}

async function mutate(env, token, service, operations) {
  if (!operations.length) return { ok: true, skipped: true, results: [] };
  const customerId = env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/${service}:mutate`, {
    method: 'POST',
    headers: headers(env, token),
    body: JSON.stringify({ customerId, operations, partialFailure: true }),
  });
  const data = await res.json();
  return {
    ok: res.ok,
    status: res.status,
    results: data.results || [],
    partial_error: data.partialFailureError?.message || null,
    raw_error: data.error?.message || null,
  };
}

async function googleAccessToken(env) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env.GOOGLE_ADS_CLIENT_ID,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth failed: ${data.error || res.status}`);
  return data.access_token;
}

function headers(env, token) {
  return {
    Authorization: `Bearer ${token}`,
    'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN,
    'login-customer-id': env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, ''),
    'Content-Type': 'application/json',
  };
}

function readGoogleEnv() {
  const aliases = {
    GOOGLE_ADS_CLIENT_ID: ['GOOGLE_ADS_CLIENT_ID', 'client_id'],
    GOOGLE_ADS_CLIENT_SECRET: ['GOOGLE_ADS_CLIENT_SECRET', 'client_secret'],
    GOOGLE_ADS_REFRESH_TOKEN: ['GOOGLE_ADS_REFRESH_TOKEN', 'refresh_token'],
    GOOGLE_ADS_DEVELOPER_TOKEN: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'developer_token'],
    GOOGLE_ADS_CUSTOMER_ID: ['GOOGLE_ADS_CUSTOMER_ID', 'customer_id'],
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: ['GOOGLE_ADS_LOGIN_CUSTOMER_ID', 'login_customer_id'],
  };
  const env = {};
  for (const key of Object.keys(aliases)) {
    if (process.env[key]) env[key] = process.env[key].trim();
  }
  if (Object.keys(aliases).some((key) => !env[key]) && fs.existsSync(TRANSFER_MD)) {
    const text = fs.readFileSync(TRANSFER_MD, 'utf8');
    for (const [key, options] of Object.entries(aliases)) {
      if (env[key]) continue;
      for (const option of options) {
        const match = text.match(new RegExp(`(?:^|[\\n\\r\\s*_-])${escapeRegex(option)}\\s*[:=]\\s*[\\\`"']?([^\\s\\\`"'<>]+)`, 'i'));
        if (match?.[1]) {
          env[key] = match[1].trim();
          break;
        }
      }
    }
  }
  env.GOOGLE_ADS_CUSTOMER_ID ||= '8564224564';
  env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ||= '6093679393';
  for (const key of Object.keys(aliases)) {
    if (!env[key]) throw new Error(`Missing ${key}`);
  }
  return env;
}

function bid(campaignId, text, matchType, bidEur) {
  return { campaignId, text, matchType, bidEur };
}

function keyFor(campaignId, text, matchType) {
  return `${campaignId}:${matchType}:${normalize(text)}`;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00df/g, 'ss')
    .replace(/oe/g, 'o')
    .replace(/ae/g, 'a')
    .replace(/ue/g, 'u')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupe(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function avgCpc(metrics) {
  const clicks = num(metrics?.clicks);
  return clicks ? round(eurRaw(metrics?.costMicros) / clicks) : 0;
}

function eur(value) {
  return round(eurRaw(value));
}

function eurRaw(value) {
  return Number(value || 0) / 1_000_000;
}

function pct(value) {
  if (value === undefined || value === null) return null;
  return round(Number(value) * 100);
}

function num(value) {
  return Number(value || 0);
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function clean(value) {
  return String(value || '')
    .replace(/Ã¼/g, '\u00fc')
    .replace(/Ã¶/g, '\u00f6')
    .replace(/Ã¤/g, '\u00e4')
    .replace(/â€”/g, '-')
    .trim();
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
