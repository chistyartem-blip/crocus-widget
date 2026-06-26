#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSFER_MD = 'C:/Users/akaza/Downloads/CROCUS_TRANSFER_FULL.md';
const API_VERSION = 'v22';
const APPLY = process.env.TOP_QS_PULL_APPLY === 'true';
const DEFAULT_SEARCH_CPC_MICROS = 500_000;

const CAMPAIGNS = {
  pmax: '23833205018',
  wimpern: '23833211183',
  pedikuere: '23873203584',
  manikuere: '23878434401',
};

const TARGET_BUDGETS_EUR = {
  // Keep cheap PMax reach, but let high-QS Man/Ped Search breathe.
  [CAMPAIGNS.pmax]: 12,
  [CAMPAIGNS.wimpern]: 3,
  [CAMPAIGNS.pedikuere]: 5,
  [CAMPAIGNS.manikuere]: 5,
};

const TOP_QS_BIDS = [
  { campaignId: CAMPAIGNS.pedikuere, text: 'pediküre göppingen', matchType: 'EXACT', bidEur: 0.50 },
  { campaignId: CAMPAIGNS.pedikuere, text: 'pediküre termin göppingen', matchType: 'EXACT', bidEur: 0.50 },
  { campaignId: CAMPAIGNS.manikuere, text: 'maniküre göppingen', matchType: 'EXACT', bidEur: 0.50 },
  { campaignId: CAMPAIGNS.manikuere, text: 'russische maniküre göppingen', matchType: 'EXACT', bidEur: 0.50 },
  { campaignId: CAMPAIGNS.manikuere, text: 'gelnägel göppingen', matchType: 'EXACT', bidEur: 0.50 },
];

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

main().catch((error) => {
  console.error(`[top-qs-pull] ${error.message}`);
  process.exit(1);
});

async function main() {
  const env = readGoogleEnv();
  const token = await googleAccessToken(env);
  const ids = Object.values(CAMPAIGNS).join(',');
  const searchIds = [CAMPAIGNS.wimpern, CAMPAIGNS.pedikuere, CAMPAIGNS.manikuere].join(',');
  const [campaigns, keywords] = await Promise.all([
    q(env, token, `
      SELECT campaign.id, campaign.name, campaign.primary_status, campaign.primary_status_reasons,
        campaign.advertising_channel_type, campaign.bidding_strategy_type,
        campaign_budget.resource_name, campaign_budget.amount_micros,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
        metrics.search_impression_share,
        metrics.search_rank_lost_impression_share,
        metrics.search_budget_lost_impression_share
      FROM campaign
      WHERE campaign.id IN (${ids})
        AND segments.date DURING TODAY
    `),
    q(env, token, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_criterion.resource_name, ad_group_criterion.status,
        ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
        ad_group_criterion.cpc_bid_micros,
        ad_group_criterion.effective_cpc_bid_micros,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.quality_info.creative_quality_score,
        ad_group_criterion.quality_info.post_click_quality_score,
        ad_group_criterion.quality_info.search_predicted_ctr,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM keyword_view
      WHERE campaign.id IN (${searchIds})
        AND ad_group_criterion.status = ENABLED
        AND segments.date DURING LAST_7_DAYS
      ORDER BY ad_group_criterion.quality_info.quality_score DESC, metrics.impressions DESC
    `),
  ]);

  const plan = buildPlan(campaigns, keywords);
  const mutations = APPLY ? await execute(env, token, plan) : dryRun(plan);
  const afterCampaigns = await q(env, token, `
    SELECT campaign.id, campaign.name, campaign.primary_status,
      campaign_budget.amount_micros,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
      metrics.search_impression_share,
      metrics.search_rank_lost_impression_share,
      metrics.search_budget_lost_impression_share
    FROM campaign
    WHERE campaign.id IN (${ids})
      AND segments.date DURING TODAY
  `);
  const report = {
    generated_at: new Date().toISOString(),
    apply: APPLY,
    reason: 'Pull traffic toward high Quality Score Search terms: weak/default Search stays at 0.50 EUR; only QS 7-10 local exact terms get enough bid to actually enter auctions.',
    top_qs_keywords: topQsKeywords(keywords),
    weak_qs_summary: weakQsSummary(keywords),
    before_campaigns: summarizeCampaigns(campaigns),
    plan,
    mutations,
    after_campaigns: summarizeCampaigns(afterCampaigns),
  };
  const reportPath = path.join(REPORT_DIR, `top-qs-pull-${stamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: APPLY,
    report: path.relative(ROOT, reportPath),
    plan_counts: {
      budgets: plan.budgetOps.length,
      keyword_cpc_repairs: plan.keywordOps.length,
    },
    top_qs_keywords: report.top_qs_keywords.slice(0, 10),
    weak_qs_summary: report.weak_qs_summary,
    after_campaigns: report.after_campaigns,
  }, null, 2));
}

function buildPlan(campaigns, keywords) {
  const budgetOps = [];
  const keywordOps = [];
  const topBidByKey = new Map(TOP_QS_BIDS.map((item) => [keywordKey(item.campaignId, item.text, item.matchType), Math.round(item.bidEur * 1_000_000)]));

  for (const row of campaigns) {
    const campaignId = String(row.campaign?.id || '');
    const target = TARGET_BUDGETS_EUR[campaignId];
    if (target === undefined) continue;
    const targetMicros = Math.round(target * 1_000_000);
    if (Number(row.campaignBudget?.amountMicros || 0) !== targetMicros) {
      budgetOps.push({
        update: { resourceName: row.campaignBudget.resourceName, amountMicros: String(targetMicros) },
        updateMask: 'amount_micros',
      });
    }
  }

  for (const row of keywords) {
    const criterion = row.adGroupCriterion || {};
    const current = Number(criterion.cpcBidMicros || criterion.effectiveCpcBidMicros || 0);
    const target = topBidByKey.get(keywordKey(row.campaign?.id, criterion.keyword?.text, criterion.keyword?.matchType)) || DEFAULT_SEARCH_CPC_MICROS;
    if (current !== target) {
      keywordOps.push({
        update: { resourceName: criterion.resourceName, cpcBidMicros: String(target) },
        updateMask: 'cpc_bid_micros',
      });
    }
  }

  return {
    budgets: TARGET_BUDGETS_EUR,
    default_search_cpc_eur: 0.5,
    top_qs_bids: TOP_QS_BIDS,
    budgetOps: dedupe(budgetOps, (op) => op.update.resourceName),
    keywordOps: dedupe(keywordOps, (op) => op.update.resourceName),
  };
}

async function execute(env, token, plan) {
  return {
    budgets: await mutate(env, token, 'campaignBudgets', plan.budgetOps),
    keywords: await mutate(env, token, 'adGroupCriteria', plan.keywordOps),
  };
}

function dryRun(plan) {
  return {
    budgets: { ok: true, skipped: 'dry_run', planned: plan.budgetOps.length },
    keywords: { ok: true, skipped: 'dry_run', planned: plan.keywordOps.length },
  };
}

function topQsKeywords(keywords) {
  return keywords
    .map(keywordSummary)
    .filter((item) => item.qs >= 7)
    .sort((a, b) => b.qs - a.qs || b.impressions - a.impressions)
    .slice(0, 25);
}

function weakQsSummary(keywords) {
  const byCampaign = {};
  for (const row of keywords.map(keywordSummary).filter((item) => item.qs && item.qs <= 4)) {
    byCampaign[row.campaign] ||= { keywords: 0, impressions: 0, clicks: 0, cost_eur: 0 };
    byCampaign[row.campaign].keywords += 1;
    byCampaign[row.campaign].impressions += row.impressions;
    byCampaign[row.campaign].clicks += row.clicks;
    byCampaign[row.campaign].cost_eur = round(byCampaign[row.campaign].cost_eur + row.cost_eur);
  }
  return byCampaign;
}

function keywordSummary(row) {
  return {
    campaign: clean(row.campaign?.name),
    ad_group: clean(row.adGroup?.name),
    text: clean(row.adGroupCriterion?.keyword?.text),
    match: row.adGroupCriterion?.keyword?.matchType,
    qs: Number(row.adGroupCriterion?.qualityInfo?.qualityScore || 0),
    bid_eur: microsToEur(row.adGroupCriterion?.cpcBidMicros || row.adGroupCriterion?.effectiveCpcBidMicros),
    impressions: num(row.metrics?.impressions),
    clicks: num(row.metrics?.clicks),
    cost_eur: microsToEur(row.metrics?.costMicros),
    avg_cpc_eur: avgCpc(row.metrics),
    conversions: Number(row.metrics?.conversions || 0),
  };
}

function keywordKey(campaignId, text, matchType) {
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

function summarizeCampaigns(rows) {
  return rows.map((row) => ({
    campaign: clean(row.campaign?.name),
    channel: row.campaign?.advertisingChannelType,
    status: row.campaign?.primaryStatus,
    reasons: row.campaign?.primaryStatusReasons || [],
    strategy: row.campaign?.biddingStrategyType,
    budget_eur: microsToEur(row.campaignBudget?.amountMicros),
    impressions: num(row.metrics?.impressions),
    clicks: num(row.metrics?.clicks),
    cost_eur: microsToEur(row.metrics?.costMicros),
    avg_cpc_eur: avgCpc(row.metrics),
    conversions: Number(row.metrics?.conversions || 0),
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
  return clicks ? round(microsRaw(metrics?.costMicros) / clicks) : 0;
}

function microsToEur(value) {
  return round(microsRaw(value));
}

function microsRaw(value) {
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
