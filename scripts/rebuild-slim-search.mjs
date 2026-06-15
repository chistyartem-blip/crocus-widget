#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(ROOT, '.env'));

const CONFIG = {
  apply: envBool('SLIM_REBUILD_APPLY', false),
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
  manikuere: '23878434401',
  pedikuere: '23873203584',
};

const AD_GROUPS = {
  manTop: '197034450619',
  manTermin: '204226383104',
  manNagelstudio: '197132834043',
  pedTop: '196092794079',
  pedFussGoeppingen: '192696615970',
  pedFussEislingen: '201029015441',
};

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `slim-search-rebuild-${stamp}.json`);
const reportMdPath = path.join(REPORT_DIR, `slim-search-rebuild-${stamp}.md`);

main().catch((error) => {
  fs.writeFileSync(reportPath, JSON.stringify({ ok: false, error: error.message }, null, 2));
  console.error(`[slim-rebuild] ${error.message}`);
  process.exit(1);
});

async function main() {
  const missing = requiredGoogleEnv().filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required Google Ads env vars: ${missing.join(', ')}`);

  const token = await googleAccessToken();
  const [keywords, campaignNegatives, ads] = await Promise.all([
    collectKeywords(token),
    collectCampaignNegatives(token),
    collectAds(token),
  ]);
  const plan = buildPlan({ keywords, campaignNegatives, ads });
  const mutations = await executePlan(token, plan);
  const report = {
    generated_at: new Date().toISOString(),
    apply: CONFIG.apply,
    plan,
    mutations,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(reportMdPath, renderMarkdown(report));
  console.log(JSON.stringify({
    ok: true,
    apply: CONFIG.apply,
    report: path.relative(ROOT, reportPath),
    markdown_report: path.relative(ROOT, reportMdPath),
    plan_counts: countPlan(plan),
  }, null, 2));
}

function buildPlan({ keywords, campaignNegatives, ads }) {
  const keywordIndex = keywordKeyIndex(keywords);
  const negativeIndex = campaignNegativeIndex(campaignNegatives);
  const activeAds = new Set(ads.map((row) => String(row.adGroup.id)));

  const keywordCreates = [];
  const keywordUpdates = [];
  const negativeCreates = [];
  const adCreates = [];

  for (const item of targetKeywords()) {
    const key = keywordKey(item.adGroupId, item.text, item.matchType);
    const existing = keywordIndex.get(key);
    if (!existing) {
      keywordCreates.push(item);
      continue;
    }
    const currentBid = euros(existing.adGroupCriterion.effectiveCpcBidMicros);
    const status = existing.adGroupCriterion.status;
    if (status !== 'ENABLED' || Math.abs(currentBid - item.bidEur) >= 0.01) {
      keywordUpdates.push({
        resourceName: existing.adGroupCriterion.resourceName,
        text: item.text,
        matchType: item.matchType,
        currentBid,
        targetBid: item.bidEur,
        currentStatus: status,
      });
    }
  }

  for (const item of bidAndStatusFixes(keywords)) keywordUpdates.push(item);

  for (const item of campaignNegatives()) {
    const key = negativeKey(item.campaignId, item.text, item.matchType);
    if (!negativeIndex.has(key)) negativeCreates.push(item);
  }

  for (const item of rsaAds()) {
    if (!activeAds.has(item.adGroupId)) adCreates.push(item);
  }

  return {
    strategy: [
      'Keep PMax alive, rebuild Slim Search around high-intent booking traffic.',
      'Add phrase service terms because small-town users often omit the city; location targeting supplies the geo.',
      'Protect budget from podology/medical/DIY/job/research traffic with campaign negatives.',
      'Lower or pause proven waste instead of blindly raising bids.',
    ],
    keywordCreates,
    keywordUpdates: dedupeUpdates(keywordUpdates),
    negativeCreates,
    adCreates,
  };
}

function targetKeywords() {
  return [
    // Manikuere: exact/phrase booking intent and local service intent.
    kw(AD_GROUPS.manTermin, 'maniküre göppingen', 'EXACT', 0.85),
    kw(AD_GROUPS.manTermin, 'maniküre termin göppingen', 'EXACT', 0.85),
    kw(AD_GROUPS.manTermin, 'nagelstudio online termin', 'EXACT', 0.75),
    kw(AD_GROUPS.manTermin, 'nagelstudio termin göppingen', 'EXACT', 0.75),
    kw(AD_GROUPS.manTop, 'maniküre', 'PHRASE', 0.42),
    kw(AD_GROUPS.manTop, 'maniküre termin', 'PHRASE', 0.48),
    kw(AD_GROUPS.manTop, 'nagelstudio', 'PHRASE', 0.38),
    kw(AD_GROUPS.manTop, 'nagelstudio termin', 'PHRASE', 0.45),
    kw(AD_GROUPS.manTop, 'russische maniküre', 'PHRASE', 0.38),
    kw(AD_GROUPS.manTop, 'gelnägel', 'PHRASE', 0.34),
    kw(AD_GROUPS.manTop, 'shellac maniküre', 'PHRASE', 0.34),
    kw(AD_GROUPS.manTop, 'nägel machen', 'PHRASE', 0.28),

    // Pedikuere: beauty/booking intent. Fusspflege is restricted to cosmetic wording.
    kw(AD_GROUPS.pedTop, 'pediküre göppingen', 'EXACT', 0.42),
    kw(AD_GROUPS.pedTop, 'pediküre termin göppingen', 'EXACT', 0.42),
    kw(AD_GROUPS.pedTop, 'pediküre', 'PHRASE', 0.30),
    kw(AD_GROUPS.pedTop, 'pediküre termin', 'PHRASE', 0.34),
    kw(AD_GROUPS.pedTop, 'kosmetische fußpflege', 'PHRASE', 0.26),
    kw(AD_GROUPS.pedTop, 'shellac pediküre', 'PHRASE', 0.26),
    kw(AD_GROUPS.pedTop, 'pediküre mit shellac', 'PHRASE', 0.26),
    kw(AD_GROUPS.pedTop, 'fußnägel', 'PHRASE', 0.22),
  ];
}

function bidAndStatusFixes(keywords) {
  const updates = [];
  for (const row of keywords) {
    const resourceName = row.adGroupCriterion.resourceName;
    const text = normalizeKeyword(row.adGroupCriterion.keyword.text);
    const matchType = row.adGroupCriterion.keyword.matchType;
    const adGroupId = String(row.adGroup.id);
    const currentBid = euros(row.adGroupCriterion.effectiveCpcBidMicros);
    const currentStatus = row.adGroupCriterion.status;

    const pause = (
      text === 'fusspflege eislingen' ||
      text === 'fusspflege ebersbach' ||
      text === 'fusspflege uhingen' ||
      text === 'fusspflege geislingen' ||
      text === 'fusspflege sussen' ||
      text === 'nagelstudio uhingen' ||
      text === 'nails goppingen' ||
      text === 'russian manicure' ||
      text === 'nail salon goppingen' ||
      text === 'nagelstudio pedikure'
    );

    if (pause && currentStatus !== 'PAUSED') {
      updates.push({ resourceName, text: row.adGroupCriterion.keyword.text, matchType, currentBid, targetBid: currentBid, currentStatus, targetStatus: 'PAUSED' });
      continue;
    }

    if (adGroupId === AD_GROUPS.manNagelstudio && text === 'nagelstudio goppingen' && currentBid > 0.28) {
      updates.push({ resourceName, text: row.adGroupCriterion.keyword.text, matchType, currentBid, targetBid: 0.28, currentStatus });
    }
  }
  return updates;
}

function campaignNegatives() {
  const common = [
    'podolog', 'podologie', 'medizinische fußpflege', 'medizinisch', 'diabetiker',
    'krankenkasse', 'rezept', 'nagelpilz', 'hühnerauge', 'eingewachsener nagel',
    'ausbildung', 'job', 'jobs', 'stellenangebot', 'kurs', 'seminar',
    'bilder', 'pinterest', 'ideen', 'designs', 'selber machen', 'zuhause',
    'set', 'dm', 'rossmann', 'amazon', 'gratis', 'kostenlos',
    'ludwigsburg', 'stuttgart', 'bad cannstatt', 'crailsheim',
  ];
  return [
    ...common.flatMap((text) => [
      neg(CAMPAIGNS.manikuere, text, 'PHRASE'),
      neg(CAMPAIGNS.pedikuere, text, 'PHRASE'),
    ]),
  ];
}

function rsaAds() {
  return [
    {
      adGroupId: AD_GROUPS.manTermin,
      finalUrl: 'https://crocus-studio.de/manikure',
      headlines: [
        'Maniküre in Göppingen',
        'Online Termin Buchen',
        'Russian Manicure',
        'Gellack & Nageldesign',
        'Saubere Studio-Qualität',
        'Crocus Beauty Studio',
        'Heute Freie Termine Prüfen',
      ],
      descriptions: [
        'Maniküre, Gellack und gepflegte Nägel in Göppingen. Termin online buchen.',
        'Crocus Beauty Studio: schöne Nägel, klare Preise, schnelle Online-Buchung.',
      ],
    },
    {
      adGroupId: AD_GROUPS.pedTop,
      finalUrl: 'https://crocus-studio.de/pedikure',
      headlines: [
        'Pediküre in Göppingen',
        'Online Termin Buchen',
        'Shellac Pediküre',
        'Kosmetische Fußpflege',
        'Schöne Füße im Studio',
        'Crocus Beauty Studio',
        'Freie Termine Prüfen',
      ],
      descriptions: [
        'Kosmetische Pediküre und Shellac in Göppingen. Freie Termine online ansehen.',
        'Beauty-Pediküre bei Crocus Beauty Studio. Einfach online buchen.',
      ],
    },
  ];
}

async function executePlan(token, plan) {
  const result = { skipped: !CONFIG.apply, keywordCreates: [], keywordUpdates: [], negativeCreates: [], adCreates: [] };
  if (!CONFIG.apply) return result;

  if (plan.keywordCreates.length) {
    result.keywordCreates = await googleMutate(token, 'adGroupCriteria', plan.keywordCreates.map((item) => ({
      create: {
        adGroup: adGroupResource(item.adGroupId),
        status: 'ENABLED',
        cpcBidMicros: String(Math.round(item.bidEur * 1_000_000)),
        keyword: { text: item.text, matchType: item.matchType },
      },
    })));
  }

  if (plan.keywordUpdates.length) {
    result.keywordUpdates = await googleMutate(token, 'adGroupCriteria', plan.keywordUpdates.map((item) => {
      const update = { resourceName: item.resourceName };
      const masks = [];
      if (item.targetBid != null && Math.abs(Number(item.currentBid || 0) - Number(item.targetBid)) >= 0.01) {
        update.cpcBidMicros = String(Math.round(item.targetBid * 1_000_000));
        masks.push('cpc_bid_micros');
      }
      if (item.targetStatus) {
        update.status = item.targetStatus;
        masks.push('status');
      }
      return { update, updateMask: masks.join(',') };
    }).filter((op) => op.updateMask));
  }

  if (plan.negativeCreates.length) {
    result.negativeCreates = await googleMutate(token, 'campaignCriteria', plan.negativeCreates.map((item) => ({
      create: {
        campaign: campaignResource(item.campaignId),
        negative: true,
        keyword: { text: item.text, matchType: item.matchType },
      },
    })));
  }

  if (plan.adCreates.length) {
    result.adCreates = await googleMutate(token, 'adGroupAds', plan.adCreates.map((item) => ({
      create: {
        adGroup: adGroupResource(item.adGroupId),
        status: 'ENABLED',
        ad: {
          finalUrls: [item.finalUrl],
          responsiveSearchAd: {
            headlines: item.headlines.map((text) => ({ text })),
            descriptions: item.descriptions.map((text) => ({ text })),
          },
        },
      },
    })));
  }

  return result;
}

function countPlan(plan) {
  return {
    keyword_creates: plan.keywordCreates.length,
    keyword_updates: plan.keywordUpdates.length,
    negative_creates: plan.negativeCreates.length,
    ad_creates: plan.adCreates.length,
  };
}

function renderMarkdown(report) {
  const plan = report.plan;
  const lines = [
    '# Slim Search Rebuild',
    '',
    `Generated: ${report.generated_at}`,
    `Apply: ${report.apply}`,
    '',
    '## Strategy',
    ...plan.strategy.map((item) => `- ${item}`),
    '',
    '## Counts',
    ...Object.entries(countPlan(plan)).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## New Keywords',
    ...plan.keywordCreates.map((item) => `- ${item.text} (${item.matchType}) -> ${item.bidEur} EUR`),
    '',
    '## Keyword Updates',
    ...plan.keywordUpdates.map((item) => `- ${item.text} (${item.matchType}) ${item.currentStatus || ''} ${item.currentBid ?? '-'} -> ${item.targetStatus || 'ENABLED'} ${item.targetBid ?? item.currentBid} EUR`),
    '',
    '## New Campaign Negatives',
    ...plan.negativeCreates.map((item) => `- ${item.text} (${item.matchType})`),
    '',
    '## New Ads',
    ...plan.adCreates.map((item) => `- ${item.adGroupId}: ${item.headlines.slice(0, 3).join(' | ')}`),
  ];
  return lines.join('\n');
}

async function collectKeywords(token) {
  return gadsSearch(token, `
    SELECT campaign.id, ad_group.id,
      ad_group_criterion.resource_name, ad_group_criterion.status,
      ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
      ad_group_criterion.effective_cpc_bid_micros
    FROM keyword_view
    WHERE campaign.id IN (${Object.values(CAMPAIGNS).join(',')})
      AND ad_group_criterion.status IN (ENABLED, PAUSED)
  `);
}

async function collectCampaignNegatives(token) {
  return gadsSearch(token, `
    SELECT campaign.id, campaign_criterion.resource_name, campaign_criterion.negative,
      campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
    FROM campaign_criterion
    WHERE campaign.id IN (${Object.values(CAMPAIGNS).join(',')})
      AND campaign_criterion.type = KEYWORD
  `);
}

async function collectAds(token) {
  return gadsSearch(token, `
    SELECT ad_group.id, ad_group_ad.ad.id, ad_group_ad.status
    FROM ad_group_ad
    WHERE campaign.id IN (${Object.values(CAMPAIGNS).join(',')})
      AND ad_group_ad.status = ENABLED
  `);
}

function keywordKeyIndex(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(keywordKey(String(row.adGroup.id), row.adGroupCriterion.keyword.text, row.adGroupCriterion.keyword.matchType), row);
  }
  return map;
}

function campaignNegativeIndex(rows) {
  const map = new Set();
  for (const row of rows) {
    if (!row.campaignCriterion?.negative) continue;
    map.add(negativeKey(String(row.campaign.id), row.campaignCriterion.keyword.text, row.campaignCriterion.keyword.matchType));
  }
  return map;
}

function dedupeUpdates(items) {
  const map = new Map();
  for (const item of items) map.set(item.resourceName, item);
  return [...map.values()];
}

function kw(adGroupId, text, matchType, bidEur) {
  return { adGroupId, text, matchType, bidEur };
}

function neg(campaignId, text, matchType) {
  return { campaignId, text, matchType };
}

function keywordKey(adGroupId, text, matchType) {
  return `${adGroupId}:${matchType}:${normalizeKeyword(text)}`;
}

function negativeKey(campaignId, text, matchType) {
  return `${campaignId}:${matchType}:${normalizeKeyword(text)}`;
}

function normalizeKeyword(value) {
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

async function gadsSearch(token, query) {
  const url = `https://googleads.googleapis.com/${CONFIG.google.apiVersion}/customers/${CONFIG.google.customerId}/googleAds:searchStream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: googleHeaders(token),
    body: JSON.stringify({ query: query.replace(/\s+/g, ' ').trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Ads search failed: ${JSON.stringify(data)}`);
  return data.flatMap((chunk) => chunk.results || []);
}

async function googleMutate(token, service, operations) {
  const url = `https://googleads.googleapis.com/${CONFIG.google.apiVersion}/customers/${CONFIG.google.customerId}/${service}:mutate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: googleHeaders(token),
    body: JSON.stringify({ customerId: CONFIG.google.customerId, operations, partialFailure: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Ads mutate ${service} failed: ${JSON.stringify(data)}`);
  if (data.partialFailureError) console.error(`[partialFailure:${service}] ${JSON.stringify(data.partialFailureError)}`);
  return data;
}

function googleHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'developer-token': CONFIG.google.developerToken,
    'login-customer-id': CONFIG.google.loginCustomerId,
    'Content-Type': 'application/json',
  };
}

function campaignResource(id) {
  return `customers/${CONFIG.google.customerId}/campaigns/${id}`;
}

function adGroupResource(id) {
  return `customers/${CONFIG.google.customerId}/adGroups/${id}`;
}

function euros(value) {
  return Math.round((Number(value || 0) / 1_000_000) * 100) / 100;
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

function envBool(key, fallback) {
  const value = process.env[key];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}
