#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSFER_MD = 'C:/Users/akaza/Downloads/CROCUS_TRANSFER_FULL.md';
const API_VERSION = 'v22';
const APPLY = process.env.SEARCH_DEVICE_CONTROLS_APPLY === 'true';
const VALIDATE_ONLY = process.env.SEARCH_DEVICE_CONTROLS_VALIDATE === 'true';

const SEARCH_CAMPAIGNS = ['23833211183', '23873203584', '23878434401'];

main().catch((error) => {
  console.error(`[search-device-controls] ${error.message}`);
  process.exit(1);
});

async function main() {
  const env = readGoogleEnv();
  const token = await googleAccessToken(env);
  const rows = await q(env, token, `
    SELECT campaign.id, campaign.name,
      campaign_criterion.resource_name,
      campaign_criterion.status,
      campaign_criterion.bid_modifier,
      campaign_criterion.device.type
    FROM campaign_criterion
    WHERE campaign.id IN (${SEARCH_CAMPAIGNS.join(',')})
      AND campaign_criterion.type = DEVICE
      AND campaign_criterion.status = ENABLED
  `);

  const ops = [];
  const planned = [];
  for (const row of rows) {
    const criterion = row.campaignCriterion || {};
    const device = criterion.device?.type;
    const current = Number(criterion.bidModifier ?? 1);
    const target = device === 'DESKTOP' ? 0 : device === 'MOBILE' && current > 1 ? 1 : null;
    if (target === null || current === target) continue;
    ops.push({
      update: { resourceName: criterion.resourceName, bidModifier: target },
      updateMask: 'bid_modifier',
    });
    planned.push({
      campaign: clean(row.campaign?.name),
      device,
      current,
      target,
    });
  }

  const mutation = APPLY ? await mutate(env, token, 'campaignCriteria', ops) : { ok: true, skipped: 'dry_run', planned: ops.length };
  const reportPath = path.join(ROOT, 'reports', `search-device-controls-${stamp()}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ apply: APPLY, validate_only: VALIDATE_ONLY, planned, mutation }, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: APPLY,
    validate_only: VALIDATE_ONLY,
    report: path.relative(ROOT, reportPath),
    planned,
    mutation: {
      ok: mutation.ok,
      status: mutation.status,
      results: mutation.results?.length || 0,
      partial_error: mutation.partial_error,
      raw_error: mutation.raw_error,
    },
  }, null, 2));
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

function clean(value) {
  return String(value || '').trim();
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
