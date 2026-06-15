#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(ROOT, '.env'));

const CONFIG = {
  google: {
    clientId: env('GOOGLE_ADS_CLIENT_ID'),
    clientSecret: env('GOOGLE_ADS_CLIENT_SECRET'),
    refreshToken: env('GOOGLE_ADS_REFRESH_TOKEN'),
    developerToken: env('GOOGLE_ADS_DEVELOPER_TOKEN'),
    customerId: env('GOOGLE_ADS_CUSTOMER_ID', '8564224564'),
    loginCustomerId: env('GOOGLE_ADS_LOGIN_CUSTOMER_ID', '6093679393'),
    apiVersion: 'v22',
  },
};

const CAMPAIGNS = {
  pmax: '23833205018',
  pedikuere: '23873203584',
  manikuere: '23878434401',
};

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(REPORT_DIR, `ads-serving-diagnostics-${stamp}.json`);
const mdPath = path.join(REPORT_DIR, `ads-serving-diagnostics-${stamp}.md`);

main().catch((error) => {
  fs.writeFileSync(jsonPath, JSON.stringify({ ok: false, error: error.message }, null, 2));
  console.error(`[ads-diagnostics] ${error.message}`);
  process.exit(1);
});

async function main() {
  const missing = requiredGoogleEnv().filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required Google Ads env vars: ${missing.join(', ')}`);

  const token = await googleAccessToken();
  const campaignIds = Object.values(CAMPAIGNS).join(',');
  const searchIds = `${CAMPAIGNS.pedikuere},${CAMPAIGNS.manikuere}`;

  const result = {
    generated_at: new Date().toISOString(),
    campaigns: await safeQuery(token, 'campaigns_today', `
      SELECT campaign.id, campaign.name, campaign.status, campaign.serving_status,
        campaign.primary_status, campaign.primary_status_reasons,
        campaign.advertising_channel_type, campaign.bidding_strategy_type,
        campaign_budget.amount_micros,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.id IN (${campaignIds}) AND segments.date DURING TODAY
    `),
    search_impression_share: await safeQuery(token, 'search_impression_share_last_7_days', `
      SELECT campaign.id, campaign.name,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
        metrics.search_impression_share, metrics.search_rank_lost_impression_share,
        metrics.search_budget_lost_impression_share
      FROM campaign
      WHERE campaign.id IN (${searchIds}) AND segments.date DURING LAST_7_DAYS
    `),
    ad_groups: await safeQuery(token, 'ad_groups_last_7_days', `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group.status,
        ad_group.type, ad_group.cpc_bid_micros,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM ad_group
      WHERE campaign.id IN (${searchIds}) AND segments.date DURING LAST_7_DAYS
    `),
    keywords: await safeQuery(token, 'keywords_last_7_days', `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_criterion.resource_name, ad_group_criterion.status,
        ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
        ad_group_criterion.system_serving_status,
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
      ORDER BY metrics.impressions DESC
    `),
    ads: await safeQuery(token, 'ads_last_7_days', `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_ad.ad.id, ad_group_ad.status, ad_group_ad.ad.type,
        ad_group_ad.policy_summary.approval_status,
        ad_group_ad.policy_summary.review_status,
        ad_group_ad.ad.final_urls,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM ad_group_ad
      WHERE campaign.id IN (${searchIds})
        AND ad_group_ad.status = ENABLED
        AND segments.date DURING LAST_7_DAYS
    `),
    criteria: await safeQuery(token, 'campaign_criteria', `
      SELECT campaign.id, campaign.name,
        campaign_criterion.type, campaign_criterion.negative,
        campaign_criterion.location.geo_target_constant,
        campaign_criterion.language.language_constant,
        campaign_criterion.ad_schedule.day_of_week,
        campaign_criterion.ad_schedule.start_hour,
        campaign_criterion.ad_schedule.end_hour
      FROM campaign_criterion
      WHERE campaign.id IN (${campaignIds})
    `),
  };

  result.summary = buildSummary(result);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(result));
  console.log(JSON.stringify({
    ok: true,
    json: path.relative(ROOT, jsonPath),
    markdown: path.relative(ROOT, mdPath),
    summary: result.summary,
  }, null, 2));
}

function buildSummary(result) {
  const campaigns = rows(result.campaigns);
  const share = rows(result.search_impression_share);
  const keywords = rows(result.keywords);
  const ads = rows(result.ads);
  const criteria = rows(result.criteria);

  const diagnosis = [];
  for (const row of campaigns) {
    const c = row.campaign;
    const m = metrics(row.metrics);
    const budget = euros(row.campaignBudget?.amountMicros);
    diagnosis.push({
      campaign: c.name,
      status: c.status,
      serving: c.servingStatus,
      primary: c.primaryStatus,
      reasons: c.primaryStatusReasons || [],
      bidding: c.biddingStrategyType,
      budget_eur: budget,
      today: m,
    });
  }

  const searchShare = share.map((row) => ({
    campaign: row.campaign.name,
    impressions: Number(row.metrics?.impressions || 0),
    clicks: Number(row.metrics?.clicks || 0),
    cost_eur: euros(row.metrics?.costMicros),
    conversions: Number(row.metrics?.conversions || 0),
    impression_share: ratio(row.metrics?.searchImpressionShare),
    lost_rank: ratio(row.metrics?.searchRankLostImpressionShare),
    lost_budget: ratio(row.metrics?.searchBudgetLostImpressionShare),
  }));

  const keywordStats = summarizeKeywords(keywords);
  const adsStats = summarizeAds(ads);
  const criteriaStats = summarizeCriteria(criteria);
  const recommendation = recommend({ diagnosis, searchShare, keywordStats, adsStats, criteriaStats });

  return { diagnosis, searchShare, keywordStats, adsStats, criteriaStats, recommendation };
}

function summarizeKeywords(keywords) {
  const enabled = keywords.length;
  const rarely = keywords.filter((row) => row.adGroupCriterion?.systemServingStatus === 'RARELY_SERVED');
  const noImpressions = keywords.filter((row) => Number(row.metrics?.impressions || 0) === 0);
  const top = keywords.slice(0, 20).map((row) => ({
    campaign: row.campaign.name,
    ad_group: row.adGroup.name,
    keyword: row.adGroupCriterion.keyword.text,
    match: row.adGroupCriterion.keyword.matchType,
    serving: row.adGroupCriterion.systemServingStatus,
    bid_eur: euros(row.adGroupCriterion.effectiveCpcBidMicros),
    quality_score: row.adGroupCriterion.qualityInfo?.qualityScore || null,
    predicted_ctr: row.adGroupCriterion.qualityInfo?.searchPredictedCtr || '',
    landing: row.adGroupCriterion.qualityInfo?.postClickQualityScore || '',
    ad_relevance: row.adGroupCriterion.qualityInfo?.creativeQualityScore || '',
    impressions: Number(row.metrics?.impressions || 0),
    clicks: Number(row.metrics?.clicks || 0),
    cost_eur: euros(row.metrics?.costMicros),
    conversions: Number(row.metrics?.conversions || 0),
  }));
  return { enabled, rarely_served: rarely.length, zero_impression: noImpressions.length, top };
}

function summarizeAds(ads) {
  const byApproval = {};
  for (const row of ads) {
    const key = row.adGroupAd?.policySummary?.approvalStatus || 'UNKNOWN';
    byApproval[key] = (byApproval[key] || 0) + 1;
  }
  return { enabled_ads: ads.length, approval: byApproval };
}

function summarizeCriteria(criteria) {
  const types = {};
  for (const row of criteria) {
    const key = `${row.campaignCriterion?.type || 'UNKNOWN'}${row.campaignCriterion?.negative ? '_NEGATIVE' : ''}`;
    types[key] = (types[key] || 0) + 1;
  }
  return { types };
}

function recommend({ diagnosis, searchShare, keywordStats, adsStats }) {
  const lines = [];
  const pmax = diagnosis.find((d) => d.campaign.includes('PMax'));
  const searchDead = diagnosis.filter((d) => d.campaign.includes('Slim') && d.today.impressions <= 1);
  if (pmax?.reasons?.includes('BUDGET_CONSTRAINED')) {
    lines.push('PMax gets traffic but is budget constrained. It can consume early demand and leave Search nearly invisible.');
  }
  if (searchDead.length) {
    lines.push(`Search is eligible but almost not entering auctions: ${searchDead.map((d) => d.campaign).join(', ')}.`);
  }
  if (keywordStats.rarely_served > keywordStats.enabled * 0.3) {
    lines.push(`Many keywords are RARELY_SERVED (${keywordStats.rarely_served}/${keywordStats.enabled}). The account is too narrow/low-volume for constant visibility.`);
  }
  for (const share of searchShare) {
    if ((share.lost_rank || 0) > 0.5) lines.push(`${share.campaign}: rank loss is high (${pct(share.lost_rank)}). Bids/ad rank/quality are blocking impressions.`);
    if ((share.lost_budget || 0) > 0.3) lines.push(`${share.campaign}: budget loss is high (${pct(share.lost_budget)}).`);
  }
  if (!adsStats.enabled_ads) lines.push('No enabled Search ads were found in diagnostics. This would block Search completely.');
  if (!lines.length) lines.push('No single hard block found. Most likely low volume + ad rank + PMax competition. Use Ad Preview Tool and watch 1-2 hours after bid changes.');
  return lines;
}

function renderMarkdown(result) {
  const s = result.summary;
  const lines = [
    '# Ads Serving Diagnostics',
    '',
    `Generated: ${result.generated_at}`,
    '',
    '## Verdict',
    ...s.recommendation.map((item) => `- ${item}`),
    '',
    '## Campaigns Today',
    '| Campaign | Status | Primary | Reasons | Budget | Impr | Clicks | Cost | Conv |',
    '|---|---|---|---|---:|---:|---:|---:|---:|',
    ...s.diagnosis.map((d) => `| ${d.campaign} | ${d.status}/${d.serving} | ${d.primary} | ${(d.reasons || []).join(', ')} | ${d.budget_eur} | ${d.today.impressions} | ${d.today.clicks} | ${d.today.cost_eur} | ${d.today.conversions} |`),
    '',
    '## Search Impression Share',
    '| Campaign | Impr | Clicks | Cost | Conv | IS | Lost Rank | Lost Budget |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...s.searchShare.map((d) => `| ${d.campaign} | ${d.impressions} | ${d.clicks} | ${d.cost_eur} | ${d.conversions} | ${pct(d.impression_share)} | ${pct(d.lost_rank)} | ${pct(d.lost_budget)} |`),
    '',
    '## Keywords',
    `Enabled: ${s.keywordStats.enabled}; rarely served: ${s.keywordStats.rarely_served}; zero impressions: ${s.keywordStats.zero_impression}`,
    '',
    '| Keyword | Campaign | Serving | Bid | QS | CTR | Landing | Relevance | Impr | Clicks | Cost | Conv |',
    '|---|---|---|---:|---:|---|---|---|---:|---:|---:|---:|',
    ...s.keywordStats.top.map((k) => `| ${k.keyword} (${k.match}) | ${k.campaign} | ${k.serving} | ${k.bid_eur} | ${k.quality_score ?? '-'} | ${k.predicted_ctr || '-'} | ${k.landing || '-'} | ${k.ad_relevance || '-'} | ${k.impressions} | ${k.clicks} | ${k.cost_eur} | ${k.conversions} |`),
    '',
    '## Ads',
    `Enabled ads: ${s.adsStats.enabled_ads}`,
    `Approval: ${JSON.stringify(s.adsStats.approval)}`,
    '',
    '## Criteria',
    JSON.stringify(s.criteriaStats.types),
  ];
  return lines.join('\n');
}

async function safeQuery(accessToken, name, query) {
  try {
    return { ok: true, name, rows: await gadsSearch(accessToken, query) };
  } catch (error) {
    return { ok: false, name, error: error.message, rows: [] };
  }
}

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function googleAccessToken() {
  const body = new URLSearchParams({
    client_id: CONFIG.google.clientId,
    client_secret: CONFIG.google.clientSecret,
    refresh_token: CONFIG.google.refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth failed: ${data.error || res.status}`);
  return data.access_token;
}

async function gadsSearch(accessToken, query) {
  const url = `https://googleads.googleapis.com/${CONFIG.google.apiVersion}/customers/${CONFIG.google.customerId}/googleAds:searchStream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: googleHeaders(accessToken),
    body: JSON.stringify({ query: query.replace(/\s+/g, ' ').trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Ads search failed: ${JSON.stringify(data)}`);
  return data.flatMap((chunk) => chunk.results || []);
}

function googleHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': CONFIG.google.developerToken,
    'login-customer-id': CONFIG.google.loginCustomerId,
    'Content-Type': 'application/json',
  };
}

function metrics(value) {
  return {
    impressions: Number(value?.impressions || 0),
    clicks: Number(value?.clicks || 0),
    cost_eur: euros(value?.costMicros),
    conversions: Number(value?.conversions || 0),
  };
}

function euros(micros) {
  return Math.round((Number(micros || 0) / 1_000_000) * 100) / 100;
}

function ratio(value) {
  if (value == null || value === '') return null;
  return Math.round(Number(value) * 10000) / 10000;
}

function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `${Math.round(Number(value) * 10000) / 100}%`;
}

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function requiredGoogleEnv() {
  return [
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CUSTOMER_ID',
    'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
  ];
}

function env(key, fallback = '') {
  return process.env[key] || fallback;
}
