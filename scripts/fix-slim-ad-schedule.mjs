#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(ROOT, '.env'));

const CONFIG = {
  apply: envBool('SLIM_SCHEDULE_APPLY', false),
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
const reportPath = path.join(REPORT_DIR, `slim-ad-schedule-${stamp}.json`);

main().catch((error) => {
  fs.writeFileSync(reportPath, JSON.stringify({ ok: false, error: error.message }, null, 2));
  console.error(`[slim-schedule] ${error.message}`);
  process.exit(1);
});

async function main() {
  const missing = requiredGoogleEnv().filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required Google Ads env vars: ${missing.join(', ')}`);

  const token = await googleAccessToken();
  const current = await collectSchedules(token);
  const plan = buildPlan(current);
  const mutations = await executePlan(token, plan);
  const report = { generated_at: new Date().toISOString(), apply: CONFIG.apply, plan, mutations };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: CONFIG.apply,
    report: path.relative(ROOT, reportPath),
    remove_count: plan.remove.length,
    create_count: plan.create.length,
  }, null, 2));
}

function buildPlan(current) {
  const remove = current.map((row) => ({
    campaignId: String(row.campaign.id),
    campaignName: row.campaign.name,
    resourceName: row.campaignCriterion.resourceName,
    day: row.campaignCriterion.adSchedule.dayOfWeek,
    start: row.campaignCriterion.adSchedule.startHour,
    end: row.campaignCriterion.adSchedule.endHour,
  }));
  const create = [];
  for (const campaignId of Object.values(CAMPAIGNS)) {
    for (const day of ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']) {
      create.push({ campaignId, day, start: 7, end: 23 });
    }
  }
  return {
    reason: 'Slim Search had ad schedules only at night and early evening. Open 07:00-23:00 daily so eligible campaigns can actually enter auctions during business hours.',
    remove,
    create,
  };
}

async function executePlan(token, plan) {
  const result = { skipped: !CONFIG.apply, removed: [], created: [] };
  if (!CONFIG.apply) return result;

  if (plan.remove.length) {
    result.removed = await googleMutate(token, 'campaignCriteria', plan.remove.map((item) => ({
      remove: item.resourceName,
    })));
  }

  if (plan.create.length) {
    result.created = await googleMutate(token, 'campaignCriteria', plan.create.map((item) => ({
      create: {
        campaign: campaignResource(item.campaignId),
        adSchedule: {
          dayOfWeek: item.day,
          startHour: item.start,
          startMinute: 'ZERO',
          endHour: item.end,
          endMinute: 'ZERO',
        },
      },
    })));
  }

  return result;
}

async function collectSchedules(token) {
  return gadsSearch(token, `
    SELECT campaign.id, campaign.name,
      campaign_criterion.resource_name,
      campaign_criterion.ad_schedule.day_of_week,
      campaign_criterion.ad_schedule.start_hour,
      campaign_criterion.ad_schedule.end_hour
    FROM campaign_criterion
    WHERE campaign.id IN (${Object.values(CAMPAIGNS).join(',')})
      AND campaign_criterion.type = AD_SCHEDULE
  `);
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
