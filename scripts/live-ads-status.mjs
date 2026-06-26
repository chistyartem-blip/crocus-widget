#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSFER_MD = 'C:/Users/akaza/Downloads/CROCUS_TRANSFER_FULL.md';
const API_VERSION = 'v22';

const CAMPAIGNS = {
  pmax: '23833205018',
  wimpern: '23833211183',
  pedikuere: '23873203584',
  manikuere: '23878434401',
};

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

main().catch((error) => {
  console.error(`[live-ads-status] ${error.message}`);
  process.exit(1);
});

async function main() {
  const env = readGoogleEnv();
  const token = await googleAccessToken(env);
  const allIds = Object.values(CAMPAIGNS).join(',');
  const searchIds = [CAMPAIGNS.wimpern, CAMPAIGNS.pedikuere, CAMPAIGNS.manikuere].join(',');

  const data = {
    generated_at: new Date().toISOString(),
    campaigns_today: await q(env, token, `
      SELECT campaign.id, campaign.name, campaign.status, campaign.serving_status,
        campaign.primary_status, campaign.primary_status_reasons,
        campaign.advertising_channel_type, campaign.bidding_strategy_type,
        campaign.manual_cpc.enhanced_cpc_enabled,
        campaign.geo_target_type_setting.positive_geo_target_type,
        campaign_budget.amount_micros,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.id IN (${allIds})
        AND segments.date DURING TODAY
    `),
    campaigns_yesterday: await q(env, token, `
      SELECT campaign.id, campaign.name, campaign.primary_status,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.id IN (${allIds})
        AND segments.date DURING YESTERDAY
    `),
    search_share_today: await q(env, token, `
      SELECT campaign.id, campaign.name,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
        metrics.search_impression_share,
        metrics.search_rank_lost_impression_share,
        metrics.search_budget_lost_impression_share
      FROM campaign
      WHERE campaign.id IN (${searchIds})
        AND segments.date DURING TODAY
    `),
    search_share_last_7_days: await q(env, token, `
      SELECT campaign.id, campaign.name,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
        metrics.search_impression_share,
        metrics.search_rank_lost_impression_share,
        metrics.search_budget_lost_impression_share
      FROM campaign
      WHERE campaign.id IN (${searchIds})
        AND segments.date DURING LAST_7_DAYS
    `),
    devices_today: await q(env, token, `
      SELECT campaign.id, campaign.name, segments.device,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.id IN (${allIds})
        AND segments.date DURING TODAY
      ORDER BY metrics.cost_micros DESC
    `),
    keywords_today: await q(env, token, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_criterion.resource_name, ad_group_criterion.status,
        ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
        ad_group_criterion.effective_cpc_bid_micros,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.system_serving_status,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM keyword_view
      WHERE campaign.id IN (${searchIds})
        AND ad_group_criterion.status = ENABLED
        AND segments.date DURING TODAY
      ORDER BY metrics.impressions DESC
    `),
    search_terms_today: await q(env, token, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        search_term_view.search_term,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM search_term_view
      WHERE campaign.id IN (${searchIds})
        AND segments.date DURING TODAY
      ORDER BY metrics.cost_micros DESC
    `),
    pmax_asset_groups_today: await q(env, token, `
      SELECT campaign.id, campaign.name, asset_group.id, asset_group.name, asset_group.status,
        asset_group.primary_status, asset_group.primary_status_reasons,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM asset_group
      WHERE campaign.id = ${CAMPAIGNS.pmax}
        AND segments.date DURING TODAY
    `),
    campaign_criteria: await q(env, token, `
      SELECT campaign.id, campaign.name,
        campaign_criterion.type, campaign_criterion.status, campaign_criterion.negative,
        campaign_criterion.bid_modifier,
        campaign_criterion.device.type,
        campaign_criterion.location.geo_target_constant,
        campaign_criterion.ad_schedule.day_of_week,
        campaign_criterion.ad_schedule.start_hour,
        campaign_criterion.ad_schedule.end_hour
      FROM campaign_criterion
      WHERE campaign.id IN (${allIds})
    `),
  };

  const summary = summarize(data);
  const report = { ...data, summary };
  const reportPath = path.join(REPORT_DIR, `live-ads-status-${stamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    report: path.relative(ROOT, reportPath),
    summary,
  }, null, 2));
}

function summarize(data) {
  return {
    campaigns_today: data.campaigns_today.map((row) => ({
      id: row.campaign?.id,
      name: clean(row.campaign?.name),
      channel: row.campaign?.advertisingChannelType,
      strategy: row.campaign?.biddingStrategyType,
      enhanced_cpc: row.campaign?.manualCpc?.enhancedCpcEnabled ?? null,
      status: row.campaign?.primaryStatus,
      reasons: row.campaign?.primaryStatusReasons || [],
      budget_eur: eur(row.campaignBudget?.amountMicros),
      impressions: n(row.metrics?.impressions),
      clicks: n(row.metrics?.clicks),
      cost_eur: eur(row.metrics?.costMicros),
      avg_cpc_eur: avgCpc(row.metrics),
      conversions: Number(row.metrics?.conversions || 0),
    })),
    search_share_today: data.search_share_today.map(searchShareRow),
    search_share_last_7_days: data.search_share_last_7_days.map(searchShareRow),
    devices_today: data.devices_today.map((row) => ({
      campaign: clean(row.campaign?.name),
      device: row.segments?.device,
      impressions: n(row.metrics?.impressions),
      clicks: n(row.metrics?.clicks),
      cost_eur: eur(row.metrics?.costMicros),
      avg_cpc_eur: avgCpc(row.metrics),
    })),
    top_keywords_today: data.keywords_today.slice(0, 20).map((row) => ({
      campaign: clean(row.campaign?.name),
      text: clean(row.adGroupCriterion?.keyword?.text),
      match: row.adGroupCriterion?.keyword?.matchType,
      bid_eur: eur(row.adGroupCriterion?.effectiveCpcBidMicros),
      qs: row.adGroupCriterion?.qualityInfo?.qualityScore || null,
      system_status: row.adGroupCriterion?.systemServingStatus,
      impressions: n(row.metrics?.impressions),
      clicks: n(row.metrics?.clicks),
      cost_eur: eur(row.metrics?.costMicros),
      avg_cpc_eur: avgCpc(row.metrics),
    })),
    search_terms_today: data.search_terms_today.slice(0, 15).map((row) => ({
      campaign: clean(row.campaign?.name),
      term: clean(row.searchTermView?.searchTerm),
      impressions: n(row.metrics?.impressions),
      clicks: n(row.metrics?.clicks),
      cost_eur: eur(row.metrics?.costMicros),
      avg_cpc_eur: avgCpc(row.metrics),
    })),
    pmax_asset_groups_today: data.pmax_asset_groups_today.map((row) => ({
      name: clean(row.assetGroup?.name),
      status: row.assetGroup?.primaryStatus,
      reasons: row.assetGroup?.primaryStatusReasons || [],
      impressions: n(row.metrics?.impressions),
      clicks: n(row.metrics?.clicks),
      cost_eur: eur(row.metrics?.costMicros),
      avg_cpc_eur: avgCpc(row.metrics),
    })),
  };
}

function searchShareRow(row) {
  return {
    campaign: clean(row.campaign?.name),
    impressions: n(row.metrics?.impressions),
    clicks: n(row.metrics?.clicks),
    cost_eur: eur(row.metrics?.costMicros),
    avg_cpc_eur: avgCpc(row.metrics),
    conversions: Number(row.metrics?.conversions || 0),
    impression_share: pct(row.metrics?.searchImpressionShare),
    rank_lost: pct(row.metrics?.searchRankLostImpressionShare),
    budget_lost: pct(row.metrics?.searchBudgetLostImpressionShare),
  };
}

async function q(env, token, query) {
  const customerId = env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN,
      'login-customer-id': env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, ''),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: query.replace(/\s+/g, ' ').trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data.flatMap((chunk) => chunk.results || []);
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

function avgCpc(metrics) {
  const clicks = n(metrics?.clicks);
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

function n(value) {
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
