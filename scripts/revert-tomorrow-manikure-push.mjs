#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(ROOT, '.env'));

const CONFIG = {
  apply: envBool('REVERT_TOMORROW_MANIKURE_PUSH_APPLY', false),
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

const TEMP_KEYWORD_RESOURCES = [
  'customers/8564224564/adGroupCriteria/197034450619~2490171251024',
  'customers/8564224564/adGroupCriteria/197034450619~2490171251184',
  'customers/8564224564/adGroupCriteria/204226383104~2490171251224',
  'customers/8564224564/adGroupCriteria/204226383104~2490171251264',
];

const BID_RESTORE = [
  ['customers/8564224564/adGroupCriteria/204226383104~486350094218', 0.70, 'manik\u00fcre g\u00f6ppingen'],
  ['customers/8564224564/adGroupCriteria/204226383104~2483931480650', 0.70, 'manik\u00fcre termin g\u00f6ppingen'],
  ['customers/8564224564/adGroupCriteria/204226383104~335168122315', 0.60, 'nagelstudio online termin'],
  ['customers/8564224564/adGroupCriteria/204226383104~2437425218848', 0.60, 'nagelstudio termin g\u00f6ppingen'],
  ['customers/8564224564/adGroupCriteria/197034450619~885786887167', 0.33, 'manik\u00fcre termin'],
  ['customers/8564224564/adGroupCriteria/197034450619~819624777337', 0.30, 'nagelstudio termin'],
];

const TEMP_AD_RESOURCES = [
  'customers/8564224564/adGroupAds/204226383104~813175469193',
  'customers/8564224564/adGroupAds/197034450619~813175469196',
];

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `revert-tomorrow-manikure-push-${stamp}.json`);

main().catch((error) => {
  fs.writeFileSync(reportPath, JSON.stringify({ ok: false, error: error.message }, null, 2));
  console.error(`[revert-tomorrow-push] ${error.message}`);
  process.exit(1);
});

async function main() {
  const missing = requiredGoogleEnv().filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required Google Ads env vars: ${missing.join(', ')}`);

  const token = await googleAccessToken();
  const plan = {
    reason: 'Booking was captured; revert temporary tomorrow Manikure push and return Search to normal working mode.',
    pauseTempKeywords: TEMP_KEYWORD_RESOURCES,
    restoreBids: BID_RESTORE.map(([resourceName, bidEur, text]) => ({ resourceName, bidEur, text })),
    pauseTempAds: TEMP_AD_RESOURCES,
  };
  const mutations = await executePlan(token, plan);
  const report = { generated_at: new Date().toISOString(), apply: CONFIG.apply, plan, mutations };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: CONFIG.apply,
    report: path.relative(ROOT, reportPath),
    pause_keywords: plan.pauseTempKeywords.length,
    restore_bids: plan.restoreBids.length,
    pause_ads: plan.pauseTempAds.length,
  }, null, 2));
}

async function executePlan(token, plan) {
  const result = { skipped: !CONFIG.apply, pausedKeywords: [], restoredBids: [], pausedAds: [] };
  if (!CONFIG.apply) return result;

  result.pausedKeywords = await googleMutate(token, 'adGroupCriteria', plan.pauseTempKeywords.map((resourceName) => ({
    update: { resourceName, status: 'PAUSED' },
    updateMask: 'status',
  })));

  result.restoredBids = await googleMutate(token, 'adGroupCriteria', plan.restoreBids.map((item) => ({
    update: { resourceName: item.resourceName, cpcBidMicros: String(Math.round(item.bidEur * 1_000_000)) },
    updateMask: 'cpc_bid_micros',
  })));

  result.pausedAds = await googleMutate(token, 'adGroupAds', plan.pauseTempAds.map((resourceName) => ({
    update: { resourceName, status: 'PAUSED' },
    updateMask: 'status',
  })));

  return result;
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
