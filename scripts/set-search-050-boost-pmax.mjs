#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSFER_MD = 'C:/Users/akaza/Downloads/CROCUS_TRANSFER_FULL.md';
const API_VERSION = 'v22';
const APPLY = process.env.SEARCH_050_PMAX_APPLY === 'true';
const SEARCH_CPC_MICROS = Math.round(Number(process.env.SEARCH_CPC_EUR || '0.50') * 1_000_000);

const CAMPAIGNS = {
  pmax: '23833205018',
  wimpern: '23833211183',
  pedikuere: '23873203584',
  manikuere: '23878434401',
};

const TARGET_BUDGETS_EUR = {
  [CAMPAIGNS.pmax]: 12,
  [CAMPAIGNS.wimpern]: 3,
  [CAMPAIGNS.pedikuere]: 5,
  [CAMPAIGNS.manikuere]: 5,
};

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

main().catch((error) => {
  console.error(`[search-050-pmax] ${error.message}`);
  process.exit(1);
});

async function main() {
  const env = readGoogleEnv();
  const token = await googleAccessToken(env);
  const ids = Object.values(CAMPAIGNS).join(',');
  const searchIds = [CAMPAIGNS.wimpern, CAMPAIGNS.pedikuere, CAMPAIGNS.manikuere].join(',');

  const before = await snapshot(env, token, ids, searchIds);
  const plan = buildPlan(env, before);
  const mutations = APPLY ? await executePlan(env, token, plan) : dryRun(plan);
  const after = await snapshot(env, token, ids, searchIds);
  const report = {
    generated_at: new Date().toISOString(),
    apply: APPLY,
    reason: 'User requested all keyword bids at 0.50 EUR and PMax boost without increasing total daily budget above 25 EUR.',
    target_search_cpc_eur: microsToEur(SEARCH_CPC_MICROS),
    target_budgets_eur: TARGET_BUDGETS_EUR,
    before: summarize(before),
    plan_counts: countPlan(plan),
    plan,
    mutations,
    after: summarize(after),
    verification: verify(after),
  };
  const reportPath = path.join(REPORT_DIR, `search-050-pmax-boost-${stamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: APPLY,
    report: path.relative(ROOT, reportPath),
    plan_counts: report.plan_counts,
    verification: report.verification,
    after: report.after,
  }, null, 2));
}

async function snapshot(env, token, ids, searchIds) {
  return {
    campaigns: await q(env, token, `
      SELECT campaign.id, campaign.name, campaign.primary_status, campaign.primary_status_reasons,
        campaign.advertising_channel_type, campaign.bidding_strategy_type,
        campaign.manual_cpc.enhanced_cpc_enabled,
        campaign_budget.resource_name, campaign_budget.amount_micros,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.id IN (${ids})
        AND segments.date DURING TODAY
    `),
    adGroups: await q(env, token, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group.resource_name, ad_group.status, ad_group.cpc_bid_micros
      FROM ad_group
      WHERE campaign.id IN (${searchIds})
        AND ad_group.status IN (ENABLED, PAUSED)
    `),
    keywords: await q(env, token, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_criterion.resource_name, ad_group_criterion.status,
        ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
        ad_group_criterion.cpc_bid_micros,
        ad_group_criterion.effective_cpc_bid_micros
      FROM keyword_view
      WHERE campaign.id IN (${searchIds})
        AND ad_group_criterion.status IN (ENABLED, PAUSED)
    `),
  };
}

function buildPlan(env, data) {
  const budgetOps = [];
  const adGroupOps = [];
  const keywordOps = [];

  for (const row of data.campaigns) {
    const campaignId = String(row.campaign?.id || '');
    const target = TARGET_BUDGETS_EUR[campaignId];
    if (target === undefined) continue;
    const currentMicros = Number(row.campaignBudget?.amountMicros || 0);
    const targetMicros = Math.round(target * 1_000_000);
    if (currentMicros !== targetMicros) {
      budgetOps.push({
        update: {
          resourceName: row.campaignBudget.resourceName,
          amountMicros: String(targetMicros),
        },
        updateMask: 'amount_micros',
      });
    }
  }

  for (const row of data.adGroups) {
    if (Number(row.adGroup?.cpcBidMicros || 0) !== SEARCH_CPC_MICROS) {
      adGroupOps.push({
        update: {
          resourceName: row.adGroup.resourceName,
          cpcBidMicros: String(SEARCH_CPC_MICROS),
        },
        updateMask: 'cpc_bid_micros',
      });
    }
  }

  for (const row of data.keywords) {
    const criterion = row.adGroupCriterion || {};
    const current = Number(criterion.cpcBidMicros || criterion.effectiveCpcBidMicros || 0);
    if (current !== SEARCH_CPC_MICROS) {
      keywordOps.push({
        update: {
          resourceName: criterion.resourceName,
          cpcBidMicros: String(SEARCH_CPC_MICROS),
        },
        updateMask: 'cpc_bid_micros',
      });
    }
  }

  return {
    budgetOps: dedupe(budgetOps, (op) => op.update.resourceName),
    adGroupOps: dedupe(adGroupOps, (op) => op.update.resourceName),
    keywordOps: dedupe(keywordOps, (op) => op.update.resourceName),
  };
}

async function executePlan(env, token, plan) {
  return {
    budgets: await mutate(env, token, 'campaignBudgets', plan.budgetOps),
    adGroups: await mutate(env, token, 'adGroups', plan.adGroupOps),
    keywords: await mutate(env, token, 'adGroupCriteria', plan.keywordOps),
  };
}

function dryRun(plan) {
  return Object.fromEntries(Object.entries(plan).map(([key, value]) => [key, { ok: true, skipped: 'dry_run', planned: value.length }]));
}

function verify(data) {
  const badKeywords = data.keywords.filter((row) => Number(row.adGroupCriterion?.cpcBidMicros || row.adGroupCriterion?.effectiveCpcBidMicros || 0) !== SEARCH_CPC_MICROS);
  const badAdGroups = data.adGroups.filter((row) => Number(row.adGroup?.cpcBidMicros || 0) !== SEARCH_CPC_MICROS);
  const budgets = {};
  for (const row of data.campaigns) budgets[clean(row.campaign?.name)] = microsToEur(row.campaignBudget?.amountMicros);
  return {
    keywords_not_050: badKeywords.length,
    ad_groups_not_050: badAdGroups.length,
    budgets,
    total_budget_eur: Object.values(budgets).reduce((sum, value) => sum + Number(value || 0), 0),
  };
}

function summarize(data) {
  return {
    campaigns: data.campaigns.map((row) => ({
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
    })),
    keyword_bid_distribution: distribution(data.keywords.map((row) => microsToEur(row.adGroupCriterion?.cpcBidMicros || row.adGroupCriterion?.effectiveCpcBidMicros))),
    ad_group_bid_distribution: distribution(data.adGroups.map((row) => microsToEur(row.adGroup?.cpcBidMicros))),
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

function countPlan(plan) {
  return Object.fromEntries(Object.entries(plan).map(([key, value]) => [key, value.length]));
}

function distribution(values) {
  const out = {};
  for (const value of values) out[String(value)] = (out[String(value)] || 0) + 1;
  return out;
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
