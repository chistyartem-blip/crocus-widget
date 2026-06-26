#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSFER_MD = 'C:/Users/akaza/Downloads/CROCUS_TRANSFER_FULL.md';
const API_VERSION = 'v22';
const APPLY = process.env.SEARCH_CPC50_HYGIENE_APPLY === 'true';
const VALIDATE_ONLY = process.env.SEARCH_CPC50_HYGIENE_VALIDATE === 'true';
const CPC_CEILING_MICROS = 500_000;

const CAMPAIGNS = {
  pmax: '23833205018',
  wimpern: '23833211183',
  pedikuere: '23873203584',
  manikuere: '23878434401',
};

const SEARCH_CAMPAIGN_IDS = [CAMPAIGNS.wimpern, CAMPAIGNS.pedikuere, CAMPAIGNS.manikuere];
const MANIKURE_SKAG_AD_GROUP_ID = '204226383104';

const FAR_CITY_NEGATIVES = [
  'aalen',
  'ulm',
  'oehringen',
  '\u00f6hringen',
  'tuebingen',
  't\u00fcbingen',
  'heidenheim',
  'sindelfingen',
  'blaubeuren',
  'metzingen',
  'reutlingen',
  'stuttgart',
];

const EXACT_WASTE_NEGATIVES = [
  { campaignId: CAMPAIGNS.manikuere, text: 'n\u00e4gel g\u00f6ppingen', matchType: 'EXACT' },
  { campaignId: CAMPAIGNS.manikuere, text: 'nagelstudios g\u00f6ppingen', matchType: 'EXACT' },
  { campaignId: CAMPAIGNS.wimpern, text: 'korean lash lift in der n\u00e4he', matchType: 'EXACT' },
];

const ASCII_MANIKURE_KEYWORDS = [
  { adGroupId: MANIKURE_SKAG_AD_GROUP_ID, text: 'manikure goppingen', matchType: 'EXACT', bidMicros: CPC_CEILING_MICROS },
  { adGroupId: MANIKURE_SKAG_AD_GROUP_ID, text: 'manikure goeppingen', matchType: 'EXACT', bidMicros: CPC_CEILING_MICROS },
];

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

main().catch((error) => {
  console.error(`[search-cpc50-hygiene] ${error.message}`);
  process.exit(1);
});

async function main() {
  const env = readGoogleEnv();
  const token = await googleAccessToken(env);
  const customerId = env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');
  const searchIds = SEARCH_CAMPAIGN_IDS.join(',');
  const allIds = Object.values(CAMPAIGNS).join(',');

  const [campaigns, keywords, adGroups, existingNegatives, device30d] = await Promise.all([
    q(env, token, `
      SELECT campaign.id, campaign.name, campaign.resource_name, campaign.bidding_strategy_type,
        campaign.status
      FROM campaign
      WHERE campaign.id IN (${searchIds})
    `),
    q(env, token, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_criterion.resource_name, ad_group_criterion.status,
        ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
        ad_group_criterion.cpc_bid_micros,
        ad_group_criterion.effective_cpc_bid_micros
      FROM keyword_view
      WHERE campaign.id IN (${searchIds})
        AND ad_group_criterion.status = ENABLED
    `),
    q(env, token, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group.resource_name, ad_group.status, ad_group.cpc_bid_micros
      FROM ad_group
      WHERE campaign.id IN (${searchIds})
        AND ad_group.status = ENABLED
    `),
    q(env, token, `
      SELECT campaign.id, campaign.name, campaign_criterion.resource_name,
        campaign_criterion.negative,
        campaign_criterion.keyword.text,
        campaign_criterion.keyword.match_type
      FROM campaign_criterion
      WHERE campaign.id IN (${allIds})
        AND campaign_criterion.type = KEYWORD
        AND campaign_criterion.negative = true
    `),
    q(env, token, `
      SELECT campaign.id, campaign.name, segments.device,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.id IN (${allIds})
        AND segments.date DURING LAST_30_DAYS
      ORDER BY metrics.cost_micros DESC
    `),
  ]);

  const plan = buildPlan({ env, customerId, campaigns, keywords, adGroups, existingNegatives });
  const mutations = APPLY ? await execute(env, token, plan) : dryRun(plan);
  const after = await q(env, token, `
    SELECT campaign.id, campaign.name, campaign.bidding_strategy_type,
      campaign.status,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM campaign
    WHERE campaign.id IN (${searchIds})
      AND segments.date DURING TODAY
  `);

  const report = {
    generated_at: new Date().toISOString(),
    apply: APPLY,
    validate_only: VALIDATE_ONLY,
    reason: 'Search hygiene: hard CPC 0.50 cap, far-city query negatives, exact waste blockers, ASCII Manikure coverage.',
    device_30d: summarizeDevice(device30d),
    plan_counts: countPlan(plan),
    plan_preview: previewPlan(plan),
    mutations,
    after: after.map(campaignSummary),
  };
  const reportPath = path.join(REPORT_DIR, `search-cpc50-hygiene-${stamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: APPLY,
    validate_only: VALIDATE_ONLY,
    report: path.relative(ROOT, reportPath),
    device_30d: report.device_30d,
    plan_counts: report.plan_counts,
    mutations: summarizeMutations(mutations),
    after: report.after,
  }, null, 2));
}

function buildPlan({ env, customerId, campaigns, keywords, adGroups, existingNegatives }) {
  // Keep bidding strategy unchanged here. API validation showed the REST shape for
  // Max Clicks differs in v22; the no-risk part is enforcing the same 0.50 cap
  // on manual CPC entities and blocking waste.
  const campaignOps = [];

  const adGroupOps = [];
  for (const row of adGroups) {
    const current = Number(row.adGroup?.cpcBidMicros || 0);
    if (current > CPC_CEILING_MICROS) {
      adGroupOps.push({
        update: { resourceName: row.adGroup.resourceName, cpcBidMicros: String(CPC_CEILING_MICROS) },
        updateMask: 'cpc_bid_micros',
      });
    }
  }

  const keywordOps = [];
  const keywordKeys = new Set();
  for (const row of keywords) {
    const criterion = row.adGroupCriterion || {};
    keywordKeys.add(keyFor(row.adGroup?.id, criterion.keyword?.text, criterion.keyword?.matchType));
    const current = Number(criterion.cpcBidMicros || criterion.effectiveCpcBidMicros || 0);
    if (current > CPC_CEILING_MICROS) {
      keywordOps.push({
        update: { resourceName: criterion.resourceName, cpcBidMicros: String(CPC_CEILING_MICROS) },
        updateMask: 'cpc_bid_micros',
      });
    }
  }
  for (const item of ASCII_MANIKURE_KEYWORDS) {
    const key = keyFor(item.adGroupId, item.text, item.matchType);
    if (keywordKeys.has(key)) continue;
    keywordOps.push({
      create: {
        adGroup: `customers/${customerId}/adGroups/${item.adGroupId}`,
        status: 'ENABLED',
        cpcBidMicros: String(item.bidMicros),
        keyword: { text: item.text, matchType: item.matchType },
      },
    });
  }

  const negativeKeys = new Set(existingNegatives.map((row) => negativeKey(row.campaign?.id, row.campaignCriterion?.keyword?.text, row.campaignCriterion?.keyword?.matchType)));
  const negativeOps = [];
  const negativeTargets = [
    ...Object.values(CAMPAIGNS).flatMap((campaignId) => FAR_CITY_NEGATIVES.map((text) => ({ campaignId, text, matchType: 'BROAD' }))),
    ...EXACT_WASTE_NEGATIVES,
  ];
  for (const target of negativeTargets) {
    const key = negativeKey(target.campaignId, target.text, target.matchType);
    if (negativeKeys.has(key)) continue;
    negativeOps.push({
      create: {
        campaign: `customers/${customerId}/campaigns/${target.campaignId}`,
        negative: true,
        keyword: { text: target.text, matchType: target.matchType },
      },
    });
  }

  return {
    campaignOps: dedupe(campaignOps, (op) => op.update.resourceName),
    adGroupOps: dedupe(adGroupOps, (op) => op.update.resourceName),
    keywordOps: dedupe(keywordOps, (op) => op.update?.resourceName || `${op.create.adGroup}:${op.create.keyword.text}:${op.create.keyword.matchType}`),
    negativeOps: dedupe(negativeOps, (op) => `${op.create.campaign}:${op.create.keyword.text}:${op.create.keyword.matchType}`),
  };
}

async function execute(env, token, plan) {
  return {
    campaigns: await mutate(env, token, 'campaigns', plan.campaignOps),
    adGroups: await mutate(env, token, 'adGroups', plan.adGroupOps),
    keywords: await mutate(env, token, 'adGroupCriteria', plan.keywordOps),
    negatives: await mutate(env, token, 'campaignCriteria', plan.negativeOps),
  };
}

function dryRun(plan) {
  return {
    campaigns: { ok: true, skipped: 'dry_run', planned: plan.campaignOps.length },
    adGroups: { ok: true, skipped: 'dry_run', planned: plan.adGroupOps.length },
    keywords: { ok: true, skipped: 'dry_run', planned: plan.keywordOps.length },
    negatives: { ok: true, skipped: 'dry_run', planned: plan.negativeOps.length },
  };
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
    body: JSON.stringify({ customerId, operations, partialFailure: true, validateOnly: VALIDATE_ONLY }),
  });
  const data = await res.json();
  return {
    ok: res.ok,
    status: res.status,
    validate_only: VALIDATE_ONLY,
    results: data.results || [],
    partial_error: data.partialFailureError?.message || null,
    raw_error: data.error?.message || null,
  };
}

function headers(env, token) {
  return {
    Authorization: `Bearer ${token}`,
    'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN,
    'login-customer-id': env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, ''),
    'Content-Type': 'application/json',
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
        if (match) {
          env[key] = match[1].trim();
          break;
        }
      }
    }
  }
  const missing = Object.keys(aliases).filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing required Google Ads credentials: ${missing.join(', ')}`);
  return env;
}

function summarizeDevice(rows) {
  return rows.map((row) => ({
    campaign: clean(row.campaign?.name),
    device: row.segments?.device,
    impressions: num(row.metrics?.impressions),
    clicks: num(row.metrics?.clicks),
    cost_eur: eur(row.metrics?.costMicros),
    conversions: Number(row.metrics?.conversions || 0),
  }));
}

function campaignSummary(row) {
  return {
    campaign: clean(row.campaign?.name),
    strategy: row.campaign?.biddingStrategyType,
    impressions: num(row.metrics?.impressions),
    clicks: num(row.metrics?.clicks),
    cost_eur: eur(row.metrics?.costMicros),
    conversions: Number(row.metrics?.conversions || 0),
  };
}

function countPlan(plan) {
  return {
    campaigns_to_max_clicks_cpc50: plan.campaignOps.length,
    ad_group_cpc_caps: plan.adGroupOps.length,
    keyword_cpc_caps_or_creates: plan.keywordOps.length,
    negative_keyword_creates: plan.negativeOps.length,
  };
}

function previewPlan(plan) {
  return {
    keyword_ops: plan.keywordOps.slice(0, 12),
    negative_ops: plan.negativeOps.slice(0, 12),
  };
}

function summarizeMutations(mutations) {
  return Object.fromEntries(Object.entries(mutations).map(([key, value]) => [key, {
    ok: value.ok,
    status: value.status,
    results: value.results?.length || 0,
    partial_error: value.partial_error,
    raw_error: value.raw_error,
  }]));
}

function keyFor(adGroupId, text, matchType) {
  return `${adGroupId}:${String(matchType || '').toUpperCase()}:${normalize(text)}`;
}

function negativeKey(campaignId, text, matchType) {
  return `${campaignId}:${String(matchType || '').toUpperCase()}:${normalize(text)}`;
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

function clean(value) {
  return String(value || '').trim();
}

function num(value) {
  return Number(value || 0);
}

function eur(value) {
  return Math.round(Number(value || 0) / 10_000) / 100;
}

function dedupe(items, keyFn) {
  const map = new Map();
  for (const item of items) map.set(keyFn(item), item);
  return [...map.values()];
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
