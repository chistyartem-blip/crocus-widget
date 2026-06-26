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

const PROBE_QUERIES = [
  ['manikuere_umlaut', 'manik\u00fcre g\u00f6ppingen'],
  ['manikure_ascii', 'manikure goppingen'],
  ['manicure_en', 'manicure goppingen'],
  ['nagelstudio', 'nagelstudio g\u00f6ppingen'],
  ['russische_manikure', 'russische manik\u00fcre g\u00f6ppingen'],
  ['gelnaegel', 'geln\u00e4gel g\u00f6ppingen'],
  ['pedikuere_umlaut', 'pedik\u00fcre g\u00f6ppingen'],
  ['pedikure_ascii', 'pedikure goppingen'],
  ['fussnaegel', 'fu\u00dfn\u00e4gel g\u00f6ppingen'],
  ['wimpern', 'wimpern g\u00f6ppingen'],
  ['wimpernverlaengerung', 'wimpernverl\u00e4ngerung g\u00f6ppingen'],
  ['lash_extensions', 'lash extensions g\u00f6ppingen'],
];

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

main().catch((error) => {
  console.error(`[negative-audit] ${error.message}`);
  process.exit(1);
});

async function main() {
  const env = readGoogleEnv();
  const token = await googleAccessToken(env);
  const ids = Object.values(CAMPAIGNS).join(',');
  const searchIds = [CAMPAIGNS.wimpern, CAMPAIGNS.pedikuere, CAMPAIGNS.manikuere].join(',');

  const [campaignNegatives, adGroupNegatives, enabledKeywords, searchTerms] = await Promise.all([
    q(env, token, `
      SELECT campaign.id, campaign.name,
        campaign_criterion.resource_name,
        campaign_criterion.status,
        campaign_criterion.negative,
        campaign_criterion.keyword.text,
        campaign_criterion.keyword.match_type
      FROM campaign_criterion
      WHERE campaign.id IN (${ids})
        AND campaign_criterion.type = KEYWORD
        AND campaign_criterion.negative = true
    `),
    q(env, token, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_criterion.resource_name,
        ad_group_criterion.status,
        ad_group_criterion.negative,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type
      FROM ad_group_criterion
      WHERE campaign.id IN (${searchIds})
        AND ad_group_criterion.type = KEYWORD
        AND ad_group_criterion.negative = true
    `).catch((error) => [{ error: error.message }]),
    q(env, token, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_criterion.resource_name,
        ad_group_criterion.status,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.effective_cpc_bid_micros,
        ad_group_criterion.quality_info.quality_score,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM keyword_view
      WHERE campaign.id IN (${searchIds})
        AND ad_group_criterion.status = ENABLED
        AND segments.date DURING LAST_7_DAYS
    `),
    q(env, token, `
      SELECT campaign.id, campaign.name,
        search_term_view.search_term,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM search_term_view
      WHERE campaign.id IN (${searchIds})
        AND segments.date DURING LAST_7_DAYS
      ORDER BY metrics.cost_micros DESC
    `),
  ]);

  const negatives = [
    ...campaignNegatives.map((row) => negativeRow(row, 'campaign')),
    ...adGroupNegatives.filter((row) => !row.error).map((row) => negativeRow(row, 'ad_group')),
  ];
  const keywordConflicts = enabledKeywords
    .map((row) => ({
      campaign: clean(row.campaign?.name),
      ad_group: clean(row.adGroup?.name),
      keyword: clean(row.adGroupCriterion?.keyword?.text),
      match: row.adGroupCriterion?.keyword?.matchType,
      qs: Number(row.adGroupCriterion?.qualityInfo?.qualityScore || 0) || null,
      impressions_7d: num(row.metrics?.impressions),
      clicks_7d: num(row.metrics?.clicks),
      cost_7d_eur: eur(row.metrics?.costMicros),
      blocking_negatives: negatives
        .filter((neg) => sameCampaignOrPmax(row.campaign?.id, neg.campaign_id) && negativeCouldBlock(neg, row.adGroupCriterion?.keyword?.text))
        .slice(0, 10),
    }))
    .filter((item) => item.blocking_negatives.length);

  const probeConflicts = [];
  for (const row of Object.values(CAMPAIGNS).map(String)) {
    for (const [label, query] of PROBE_QUERIES) {
      const hits = negatives.filter((neg) => sameCampaignOrPmax(row, neg.campaign_id) && negativeCouldBlock(neg, query));
      if (hits.length) probeConflicts.push({ campaign_id: row, label, query, blocking_negatives: hits.slice(0, 10) });
    }
  }

  const costlyTerms = searchTerms.slice(0, 30).map((row) => ({
    campaign: clean(row.campaign?.name),
    term: clean(row.searchTermView?.searchTerm),
    impressions_7d: num(row.metrics?.impressions),
    clicks_7d: num(row.metrics?.clicks),
    cost_7d_eur: eur(row.metrics?.costMicros),
    conversions_7d: Number(row.metrics?.conversions || 0),
    already_blocked_by: negatives
      .filter((neg) => sameCampaignOrPmax(row.campaign?.id, neg.campaign_id) && negativeCouldBlock(neg, row.searchTermView?.searchTerm))
      .slice(0, 5),
  }));

  const summary = {
    negative_counts: countNegatives(negatives),
    ad_group_negative_query_error: adGroupNegatives.find((row) => row.error)?.error || null,
    keyword_conflicts: keywordConflicts,
    probe_conflicts: probeConflicts,
    costly_terms: costlyTerms,
  };

  const reportPath = path.join(REPORT_DIR, `negative-coverage-${stamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    ok: true,
    report: path.relative(ROOT, reportPath),
    negative_counts: summary.negative_counts,
    keyword_conflicts: summary.keyword_conflicts.slice(0, 20),
    probe_conflicts: summary.probe_conflicts.slice(0, 20),
    costly_terms: summary.costly_terms.slice(0, 12),
  }, null, 2));
}

function negativeRow(row, level) {
  const criterion = level === 'campaign' ? row.campaignCriterion : row.adGroupCriterion;
  return {
    level,
    campaign_id: String(row.campaign?.id || ''),
    campaign: clean(row.campaign?.name),
    ad_group: clean(row.adGroup?.name),
    text: clean(criterion?.keyword?.text),
    match: criterion?.keyword?.matchType || 'UNKNOWN',
    status: criterion?.status,
  };
}

function sameCampaignOrPmax(sourceCampaignId, negativeCampaignId) {
  return String(sourceCampaignId || '') === String(negativeCampaignId || '');
}

function negativeCouldBlock(negative, query) {
  const neg = normalize(negative.text);
  const q = normalize(query);
  if (!neg || !q) return false;
  if (negative.match === 'EXACT') return q === neg;
  if (negative.match === 'PHRASE') return containsPhrase(q, neg);
  const parts = neg.split(' ').filter(Boolean);
  return parts.every((part) => q.split(' ').includes(part));
}

function containsPhrase(query, phrase) {
  return ` ${query} `.includes(` ${phrase} `);
}

function countNegatives(negatives) {
  const byCampaign = {};
  for (const neg of negatives) {
    byCampaign[neg.campaign] ||= { total: 0, broad: 0, phrase: 0, exact: 0 };
    byCampaign[neg.campaign].total += 1;
    const key = String(neg.match || '').toLowerCase();
    if (key === 'broad') byCampaign[neg.campaign].broad += 1;
    if (key === 'phrase') byCampaign[neg.campaign].phrase += 1;
    if (key === 'exact') byCampaign[neg.campaign].exact += 1;
  }
  return byCampaign;
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

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
