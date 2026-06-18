#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(ROOT, '.env'));

const CONFIG = {
  apply: envBool('SLIM_PRESENCE_APPLY', false),
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
  pedikuere: '23873203584',
  manikuere: '23878434401',
};

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(REPORT_DIR, `slim-presence-targeting-${stamp}.json`);

main().catch((error) => {
  fs.writeFileSync(reportPath, JSON.stringify({ ok: false, error: error.message }, null, 2));
  console.error(`[slim-presence] ${error.message}`);
  process.exit(1);
});

async function main() {
  const missing = requiredGoogleEnv().filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required Google Ads env vars: ${missing.join(', ')}`);

  const token = await googleAccessToken();
  const current = await collectCampaigns(token);
  const plan = buildPlan(current);
  const mutations = await executePlan(token, plan);
  const report = { generated_at: new Date().toISOString(), apply: CONFIG.apply, plan, mutations };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: CONFIG.apply,
    report: path.relative(ROOT, reportPath),
    update_count: plan.updates.length,
  }, null, 2));
}

async function collectCampaigns(token) {
  const ids = Object.values(CAMPAIGNS).join(',');
  return gadsSearch(token, `
    SELECT
      campaign.id,
      campaign.name,
      campaign.resource_name,
      campaign.geo_target_type_setting.positive_geo_target_type,
      campaign.geo_target_type_setting.negative_geo_target_type
    FROM campaign
    WHERE campaign.id IN (${ids})
  `);
}

function buildPlan(rows) {
  const updates = rows
    .map((row) => ({
      campaign_id: String(row.campaign.id),
      campaign_name: row.campaign.name,
      resource_name: row.campaign.resourceName,
      current_positive: row.campaign.geoTargetTypeSetting?.positiveGeoTargetType || '',
      current_negative: row.campaign.geoTargetTypeSetting?.negativeGeoTargetType || '',
      target_positive: 'PRESENCE',
      target_negative: 'PRESENCE',
    }))
    .filter((item) => item.current_positive !== item.target_positive || item.current_negative !== item.target_negative);

  return {
    reason: 'Local beauty Search campaigns should target people physically in the service area, not broad location interest traffic.',
    updates,
  };
}

async function executePlan(token, plan) {
  if (!CONFIG.apply) return { skipped: 'dry_run', updates: [] };
  if (!plan.updates.length) return { skipped: 'already_presence_only', updates: [] };

  return googleMutate(token, 'campaigns', plan.updates.map((item) => ({
    update: {
      resourceName: item.resource_name,
      geoTargetTypeSetting: {
        positiveGeoTargetType: item.target_positive,
        negativeGeoTargetType: item.target_negative,
      },
    },
    updateMask: 'geo_target_type_setting.positive_geo_target_type,geo_target_type_setting.negative_geo_target_type',
  })));
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
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
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

function envBool(key, fallback = false) {
  const value = process.env[key];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}
