#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(ROOT, '.env'));

const CONFIG = {
  apply: envBool('TOMORROW_MANIKURE_PUSH_APPLY', false),
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

const CAMPAIGN_ID = '23878434401'; // Slim Manikuere
const AD_GROUPS = {
  manikureTop: '197034450619',
  manikureGoeppingen: '204226383104',
  nagelstudioGoeppingen: '197132834043',
};

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `tomorrow-manikure-push-${stamp}.json`);

main().catch((error) => {
  fs.writeFileSync(reportPath, JSON.stringify({ ok: false, error: error.message }, null, 2));
  console.error(`[tomorrow-manikure-push] ${error.message}`);
  process.exit(1);
});

async function main() {
  const missing = requiredGoogleEnv().filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required Google Ads env vars: ${missing.join(', ')}`);

  const token = await googleAccessToken();
  const [keywords, ads] = await Promise.all([collectKeywords(token), collectAds(token)]);
  const plan = buildPlan({ keywords, ads });
  const mutations = await executePlan(token, plan);
  const report = { generated_at: new Date().toISOString(), apply: CONFIG.apply, plan, mutations };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: CONFIG.apply,
    report: path.relative(ROOT, reportPath),
    keyword_creates: plan.keywordCreates.length,
    bid_updates: plan.bidUpdates.length,
    ad_creates: plan.adCreates.length,
  }, null, 2));
}

function buildPlan({ keywords, ads }) {
  const keywordIndex = keywordKeyIndex(keywords);
  const activeAdFinals = new Set(ads.map((row) => `${row.adGroup.id}:${(row.adGroupAd.ad.finalUrls || []).join('|')}:${row.adGroupAd.ad.type}`));
  const keywordCreates = [];
  const bidUpdates = [];

  for (const item of targetKeywords()) {
    const existing = keywordIndex.get(keywordKey(item.adGroupId, item.text, item.matchType));
    if (!existing) {
      keywordCreates.push(item);
      continue;
    }
    const current = euros(existing.adGroupCriterion.effectiveCpcBidMicros);
    if (Math.abs(current - item.bidEur) >= 0.01) {
      bidUpdates.push({
        resourceName: existing.adGroupCriterion.resourceName,
        text: item.text,
        matchType: item.matchType,
        currentBid: current,
        targetBid: item.bidEur,
      });
    }
  }

  const adCreates = urgentAds().filter((item) => !activeAdFinals.has(`${item.adGroupId}:${item.finalUrl}:RESPONSIVE_SEARCH_AD`));

  return {
    reason: 'Tomorrow has 3 Manikuere windows with Nelia at 09:00-11:00. Push only high-intent Manikuere Search without changing budgets.',
    keywordCreates,
    bidUpdates,
    adCreates,
  };
}

function targetKeywords() {
  return [
    kw(AD_GROUPS.manikureGoeppingen, 'maniküre göppingen', 'EXACT', 0.85),
    kw(AD_GROUPS.manikureGoeppingen, 'maniküre termin göppingen', 'EXACT', 0.85),
    kw(AD_GROUPS.manikureGoeppingen, 'nagelstudio online termin', 'EXACT', 0.72),
    kw(AD_GROUPS.manikureGoeppingen, 'nagelstudio termin göppingen', 'EXACT', 0.72),
    kw(AD_GROUPS.manikureTop, 'maniküre termin', 'PHRASE', 0.42),
    kw(AD_GROUPS.manikureTop, 'nagelstudio termin', 'PHRASE', 0.40),
    kw(AD_GROUPS.manikureTop, 'maniküre morgen', 'PHRASE', 0.32),
    kw(AD_GROUPS.manikureTop, 'nagelstudio morgen', 'PHRASE', 0.30),
    kw(AD_GROUPS.manikureGoeppingen, 'maniküre morgen göppingen', 'EXACT', 0.45),
    kw(AD_GROUPS.manikureGoeppingen, 'nagelstudio morgen göppingen', 'EXACT', 0.38),
  ];
}

function urgentAds() {
  return [
    {
      adGroupId: AD_GROUPS.manikureGoeppingen,
      finalUrl: 'https://crocus-studio.de/manikure',
      headlines: [
        'Maniküre Göppingen',
        'Morgen Freie Termine',
        'Online Termin Buchen',
        'Gellack & Maniküre',
        'Crocus Beauty Studio',
        'Nelia: Freie Fenster',
        'Schöne Nägel Schnell',
      ],
      descriptions: [
        'Morgen Vormittag freie Maniküre-Termine. Jetzt online buchen.',
        'Maniküre und Gellack in Göppingen. Freie Zeiten direkt ansehen.',
      ],
    },
    {
      adGroupId: AD_GROUPS.manikureTop,
      finalUrl: 'https://crocus-studio.de/manikure',
      headlines: [
        'Maniküre Termin Frei',
        'Morgen Online Buchen',
        'Nagelstudio Göppingen',
        'Russian Manicure',
        'Gellack & gepflegte Nägel',
        'Crocus Beauty Studio',
      ],
      descriptions: [
        'Kurzfristig freie Termine für Maniküre in Göppingen. Online buchen.',
        'Saubere Maniküre, Gellack und schöne Nägel im Crocus Beauty Studio.',
      ],
    },
  ];
}

async function executePlan(token, plan) {
  const result = { skipped: !CONFIG.apply, keywordCreates: [], bidUpdates: [], adCreates: [] };
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

  if (plan.bidUpdates.length) {
    result.bidUpdates = await googleMutate(token, 'adGroupCriteria', plan.bidUpdates.map((item) => ({
      update: {
        resourceName: item.resourceName,
        cpcBidMicros: String(Math.round(item.targetBid * 1_000_000)),
      },
      updateMask: 'cpc_bid_micros',
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

async function collectKeywords(token) {
  return gadsSearch(token, `
    SELECT ad_group.id,
      ad_group_criterion.resource_name,
      ad_group_criterion.status,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.effective_cpc_bid_micros
    FROM keyword_view
    WHERE campaign.id = ${CAMPAIGN_ID}
      AND ad_group_criterion.status IN (ENABLED, PAUSED)
  `);
}

async function collectAds(token) {
  return gadsSearch(token, `
    SELECT ad_group.id, ad_group_ad.ad.id, ad_group_ad.ad.type,
      ad_group_ad.ad.final_urls, ad_group_ad.status
    FROM ad_group_ad
    WHERE campaign.id = ${CAMPAIGN_ID}
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

function kw(adGroupId, text, matchType, bidEur) {
  return { adGroupId, text, matchType, bidEur };
}

function keywordKey(adGroupId, text, matchType) {
  return `${adGroupId}:${matchType}:${normalizeKeyword(text)}`;
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
