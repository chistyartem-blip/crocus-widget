#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSFER_MD = 'C:/Users/akaza/Downloads/CROCUS_TRANSFER_FULL.md';
const API_VERSION = 'v22';
const APPLY = process.env.CPC_GUARD_APPLY === 'true';
const DISABLE_AUTO_APPLY = process.env.CPC_GUARD_DISABLE_AUTO_APPLY === 'true';
const MAX_CPC_MICROS = Math.round(Number(process.env.CPC_GUARD_MAX_EUR || '0.45') * 1_000_000);

const IDS = {
  pedikuere: '23873203584',
  manikuere: '23878434401',
};

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

main().catch((error) => {
  console.error(`[cpc-guard] ${error.message}`);
  process.exit(1);
});

async function main() {
  const env = readGoogleEnv();
  const token = await googleAccessToken(env);
  const campaignIds = Object.values(IDS).join(',');

  const before = await snapshot(env, token, campaignIds);
  const plan = buildPlan(before);
  const mutations = APPLY ? await executePlan(env, token, plan) : dryRunMutations(plan);
  const autoApplyPlan = buildAutoApplyPlan(before);
  const autoApplyMutation = APPLY && DISABLE_AUTO_APPLY
    ? await mutateRecommendationSubscriptions(env, token, autoApplyPlan)
    : { ok: true, skipped: DISABLE_AUTO_APPLY ? !APPLY : true, planned: autoApplyPlan.length };
  const after = await snapshot(env, token, campaignIds);
  const report = {
    generated_at: new Date().toISOString(),
    apply: APPLY,
    disable_auto_apply: DISABLE_AUTO_APPLY,
    max_cpc_eur: microsToEur(MAX_CPC_MICROS),
    plan_counts: countPlan(plan),
    plan,
    auto_apply_plan_count: autoApplyPlan.length,
    auto_apply_plan: autoApplyPlan,
    mutations,
    auto_apply_mutation: autoApplyMutation,
    verification: verify(after),
    before_summary: summarize(before),
    after_summary: summarize(after),
  };
  const reportPath = path.join(REPORT_DIR, `man-ped-cpc-hard-guard-${stamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: APPLY,
    max_cpc_eur: microsToEur(MAX_CPC_MICROS),
    report: path.relative(ROOT, reportPath),
    plan_counts: report.plan_counts,
    verification: report.verification,
    after: report.after_summary,
  }, null, 2));
}

async function snapshot(env, token, campaignIds) {
  const queries = {
    campaigns: `
      SELECT campaign.id, campaign.name, campaign.status, campaign.primary_status,
        campaign.primary_status_reasons, campaign.bidding_strategy_type,
        campaign.manual_cpc.enhanced_cpc_enabled, campaign_budget.amount_micros,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.id IN (${campaignIds})
        AND segments.date DURING TODAY
    `,
    adGroups: `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group.status, ad_group.cpc_bid_micros,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM ad_group
      WHERE campaign.id IN (${campaignIds})
    `,
    keywords: `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_criterion.resource_name, ad_group_criterion.status,
        ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
        ad_group_criterion.cpc_bid_micros,
        ad_group_criterion.effective_cpc_bid_micros,
        ad_group_criterion.quality_info.quality_score,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM keyword_view
      WHERE campaign.id IN (${campaignIds})
        AND ad_group_criterion.status IN (ENABLED, PAUSED)
        AND segments.date DURING TODAY
    `,
    campaignCriteria: `
      SELECT campaign.id, campaign.name,
        campaign_criterion.resource_name, campaign_criterion.type,
        campaign_criterion.status, campaign_criterion.negative,
        campaign_criterion.bid_modifier,
        campaign_criterion.device.type,
        campaign_criterion.location.geo_target_constant,
        campaign_criterion.ad_schedule.day_of_week,
        campaign_criterion.ad_schedule.start_hour,
        campaign_criterion.ad_schedule.end_hour
      FROM campaign_criterion
      WHERE campaign.id IN (${campaignIds})
        AND campaign_criterion.negative = false
    `,
    searchTerms: `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        search_term_view.search_term,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM search_term_view
      WHERE campaign.id IN (${campaignIds})
        AND segments.date DURING TODAY
      ORDER BY metrics.cost_micros DESC
    `,
  };

  const result = {};
  for (const [key, query] of Object.entries(queries)) {
    result[key] = await safeSearch(env, token, key, query);
  }

  result.adGroupBidModifiers = await safeSearch(env, token, 'adGroupBidModifiers', `
    SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
      ad_group_bid_modifier.resource_name,
      ad_group_bid_modifier.bid_modifier,
      ad_group_bid_modifier.device.type
    FROM ad_group_bid_modifier
    WHERE campaign.id IN (${campaignIds})
  `);

  result.campaignBidModifiers = await safeSearch(env, token, 'campaignBidModifiers', `
    SELECT campaign.id, campaign.name,
      campaign_bid_modifier.resource_name,
      campaign_bid_modifier.bid_modifier,
      campaign_bid_modifier.interaction_type.type
    FROM campaign_bid_modifier
    WHERE campaign.id IN (${campaignIds})
  `);

  result.recommendationSubscriptions = await safeSearch(env, token, 'recommendationSubscriptions', `
    SELECT recommendation_subscription.resource_name,
      recommendation_subscription.type,
      recommendation_subscription.status
    FROM recommendation_subscription
  `);

  return result;
}

function buildPlan(data) {
  const campaignOps = [];
  const adGroupOps = [];
  const keywordOps = [];
  const criterionOps = [];
  const adGroupBidModifierOps = [];
  const campaignBidModifierOps = [];

  for (const row of rows(data.campaigns)) {
    const campaign = row.campaign || {};
    const enhanced = campaign.manualCpc?.enhancedCpcEnabled === true;
    if (campaign.biddingStrategyType !== 'MANUAL_CPC' || enhanced) {
      campaignOps.push({
        update: {
          resourceName: campaign.resourceName || `customers/${readCustomerId()}/campaigns/${campaign.id}`,
          manualCpc: { enhancedCpcEnabled: false },
        },
        updateMask: 'manual_cpc.enhanced_cpc_enabled',
      });
    }
  }

  for (const row of rows(data.adGroups)) {
    const adGroup = row.adGroup || {};
    const bid = Number(adGroup.cpcBidMicros || 0);
    if (bid > MAX_CPC_MICROS) {
      adGroupOps.push({
        update: { resourceName: adGroup.resourceName, cpcBidMicros: String(MAX_CPC_MICROS) },
        updateMask: 'cpc_bid_micros',
      });
    }
  }

  for (const row of rows(data.keywords)) {
    const criterion = row.adGroupCriterion || {};
    const bid = Number(criterion.cpcBidMicros || criterion.effectiveCpcBidMicros || 0);
    if (criterion.status === 'ENABLED' && bid > MAX_CPC_MICROS) {
      keywordOps.push({
        update: { resourceName: criterion.resourceName, cpcBidMicros: String(MAX_CPC_MICROS) },
        updateMask: 'cpc_bid_micros',
      });
    }
  }

  for (const row of rows(data.campaignCriteria)) {
    const criterion = row.campaignCriterion || {};
    const modifier = Number(criterion.bidModifier || 0);
    if (modifier > 1) {
      criterionOps.push({
        update: { resourceName: criterion.resourceName, bidModifier: 1 },
        updateMask: 'bid_modifier',
      });
    }
  }

  for (const row of rows(data.adGroupBidModifiers)) {
    const modifier = row.adGroupBidModifier || {};
    if (Number(modifier.bidModifier || 0) > 1) {
      adGroupBidModifierOps.push({
        update: { resourceName: modifier.resourceName, bidModifier: 1 },
        updateMask: 'bid_modifier',
      });
    }
  }

  for (const row of rows(data.campaignBidModifiers)) {
    const modifier = row.campaignBidModifier || {};
    if (Number(modifier.bidModifier || 0) > 1) {
      campaignBidModifierOps.push({
        update: { resourceName: modifier.resourceName, bidModifier: 1 },
        updateMask: 'bid_modifier',
      });
    }
  }

  return {
    campaignOps,
    adGroupOps,
    keywordOps: dedupe(keywordOps, (op) => op.update.resourceName),
    criterionOps: dedupe(criterionOps, (op) => op.update.resourceName),
    adGroupBidModifierOps: dedupe(adGroupBidModifierOps, (op) => op.update.resourceName),
    campaignBidModifierOps: dedupe(campaignBidModifierOps, (op) => op.update.resourceName),
  };
}

function buildAutoApplyPlan(data) {
  const enabled = rows(data.recommendationSubscriptions)
    .map((row) => row.recommendationSubscription || {})
    .filter((item) => item.status === 'ENABLED' && item.resourceName);
  const unique = dedupe(enabled, (item) => item.resourceName);
  return unique.map((item) => ({
    update: {
      resourceName: item.resourceName,
      status: 'PAUSED',
    },
    updateMask: 'status',
  }));
}

async function executePlan(env, token, plan) {
  return {
    campaigns: await mutate(env, token, 'campaigns', plan.campaignOps),
    adGroups: await mutate(env, token, 'adGroups', plan.adGroupOps),
    adGroupCriteria: await mutate(env, token, 'adGroupCriteria', plan.keywordOps),
    campaignCriteria: await mutate(env, token, 'campaignCriteria', plan.criterionOps),
    adGroupBidModifiers: await mutate(env, token, 'adGroupBidModifiers', plan.adGroupBidModifierOps),
    campaignBidModifiers: await mutate(env, token, 'campaignBidModifiers', plan.campaignBidModifierOps),
  };
}

async function mutateRecommendationSubscriptions(env, token, operations) {
  if (!operations.length) return { ok: true, skipped: true, results: [] };
  const customerId = env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/recommendationSubscriptions:mutateRecommendationSubscription`, {
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

function dryRunMutations(plan) {
  return Object.fromEntries(Object.keys(plan).map((key) => [key, { ok: true, skipped: 'dry_run', planned: plan[key].length }]));
}

function verify(data) {
  const enabledHighKeywords = rows(data.keywords).filter((row) => {
    const criterion = row.adGroupCriterion || {};
    const bid = Number(criterion.cpcBidMicros || criterion.effectiveCpcBidMicros || 0);
    return criterion.status === 'ENABLED' && bid > MAX_CPC_MICROS;
  });
  const highAdGroups = rows(data.adGroups).filter((row) => Number(row.adGroup?.cpcBidMicros || 0) > MAX_CPC_MICROS);
  const highCriteria = rows(data.campaignCriteria).filter((row) => Number(row.campaignCriterion?.bidModifier || 0) > 1);
  const highAdGroupModifiers = rows(data.adGroupBidModifiers).filter((row) => Number(row.adGroupBidModifier?.bidModifier || 0) > 1);
  const highCampaignModifiers = rows(data.campaignBidModifiers).filter((row) => Number(row.campaignBidModifier?.bidModifier || 0) > 1);
  return {
    enabled_keywords_above_cap: enabledHighKeywords.length,
    ad_groups_above_cap: highAdGroups.length,
    campaign_criteria_modifiers_above_1: highCriteria.length,
    ad_group_bid_modifiers_above_1: highAdGroupModifiers.length,
    campaign_bid_modifiers_above_1: highCampaignModifiers.length,
    recommendation_subscriptions_query_ok: !data.recommendationSubscriptions.error,
    recommendation_subscriptions_enabled_count: rows(data.recommendationSubscriptions).filter((row) => row.recommendationSubscription?.status === 'ENABLED').length,
  };
}

function summarize(data) {
  const campaigns = rows(data.campaigns).map((row) => ({
    campaign: clean(row.campaign?.name),
    strategy: row.campaign?.biddingStrategyType,
    enhanced_cpc: row.campaign?.manualCpc?.enhancedCpcEnabled ?? null,
    status: row.campaign?.primaryStatus,
    reasons: row.campaign?.primaryStatusReasons || [],
    budget_eur: microsToEur(row.campaignBudget?.amountMicros),
    impressions: Number(row.metrics?.impressions || 0),
    clicks: Number(row.metrics?.clicks || 0),
    cost_eur: microsToEur(row.metrics?.costMicros),
    avg_cpc_eur: avgCpc(row.metrics),
  }));
  const costlyTerms = rows(data.searchTerms).slice(0, 10).map((row) => ({
    campaign: clean(row.campaign?.name),
    term: clean(row.searchTermView?.searchTerm),
    clicks: Number(row.metrics?.clicks || 0),
    cost_eur: microsToEur(row.metrics?.costMicros),
    avg_cpc_eur: avgCpc(row.metrics),
  }));
  const recommendationSubscriptions = rows(data.recommendationSubscriptions).map((row) => ({
    resource_name: row.recommendationSubscription?.resourceName,
    type: row.recommendationSubscription?.type,
    status: row.recommendationSubscription?.status,
  }));
  return { campaigns, costly_terms_today: costlyTerms, recommendation_subscriptions: recommendationSubscriptions };
}

function countPlan(plan) {
  return Object.fromEntries(Object.entries(plan).map(([key, value]) => [key, value.length]));
}

function rows(value) {
  return Array.isArray(value?.rows) ? value.rows : [];
}

async function safeSearch(env, token, label, query) {
  try {
    return { rows: await search(env, token, query) };
  } catch (error) {
    return { rows: [], error: `${label}: ${error.message}` };
  }
}

async function search(env, token, query) {
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
  const missingFromEnv = Object.keys(aliases).filter((key) => !env[key]);
  if (missingFromEnv.length && fs.existsSync(TRANSFER_MD)) {
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
    if (!env[key]) throw new Error(`Missing ${key} in transfer MD`);
  }
  return env;
}

function readCustomerId() {
  return '8564224564';
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
  const clicks = Number(metrics?.clicks || 0);
  if (!clicks) return 0;
  return Math.round((Number(metrics?.costMicros || 0) / 1_000_000 / clicks) * 100) / 100;
}

function microsToEur(value) {
  return Math.round((Number(value || 0) / 1_000_000) * 100) / 100;
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
