#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(ROOT, '.env'));

const CONFIG = {
  apply: envBool('ADS_GOVERNOR_APPLY', false),
  maxDailyBudgetEur: envNumber('ADS_GOVERNOR_MAX_DAILY_BUDGET_EUR', 30),
  lookAheadDays: envNumber('ADS_GOVERNOR_LOOKAHEAD_DAYS', 14),
  altegioProxyBase: env('ALTEGIO_PROXY_BASE', 'https://crocus-proxy.crocusbeautystudio.workers.dev/api/proxy'),
  altegioLocationId: env('ALTEGIO_LOCATION_ID', '1357963'),
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
  pmax: { id: '23833205018', name: '[PMax] Crocus Beauty Studio - Goeppingen', minBudget: 6, maxBudget: 12 },
  pedikuere: { id: '23873203584', name: '[Slim] Pedikuere - Goeppingen', minBudget: 2, maxBudget: 12 },
  manikuere: { id: '23878434401', name: '[Slim] Manikuere - Goeppingen', minBudget: 2, maxBudget: 14 },
};

const SERVICES = [
  { id: 13485753, category: 'manikuere', name: 'Manikuere + Gellack' },
  { id: 13485754, category: 'manikuere', name: 'Nagelkorrektur' },
  { id: 13485755, category: 'manikuere', name: 'Nagelverlaengerung' },
  { id: 13485760, category: 'pedikuere', name: 'Hygienische Pedikuere' },
  { id: 13485761, category: 'pedikuere', name: 'Pedikuere + Shellac' },
  { id: 13485771, category: 'wimpern', name: 'Wimpern Neuset' },
];

const MASTERS = [
  { id: 3020185, name: 'Diana', categories: ['manikuere', 'pedikuere'] },
  { id: 3020186, name: 'Nelia', categories: ['manikuere', 'pedikuere'] },
  { id: 3020187, name: 'Sofia', categories: ['manikuere', 'pedikuere'] },
  { id: 3020188, name: 'Karina', categories: ['wimpern'] },
];

const SEARCH_BID_RULES = {
  manikuere: {
    push: { exact: 0.55, phrase: 0.35 },
    push_mobile_today: { exact: 0.50, phrase: 0.32 },
    hold: { exact: 0.35, phrase: 0.25 },
    protect_budget: { exact: 0.20, phrase: 0.15 },
  },
  pedikuere: {
    push: { exact: 0.50, phrase: 0.32 },
    push_mobile_today: { exact: 0.45, phrase: 0.30 },
    hold: { exact: 0.30, phrase: 0.22 },
    protect_budget: { exact: 0.18, phrase: 0.12 },
  },
};

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const now = new Date();
const runId = isoStamp(now);
const reportPath = path.join(REPORT_DIR, `ads-governor-${runId}.json`);

main().catch((error) => {
  const payload = { generated_at: new Date().toISOString(), ok: false, apply: CONFIG.apply, error: error.message };
  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2));
  console.error(`[ads-governor] ${error.message}`);
  process.exit(1);
});

async function main() {
  const missing = requiredGoogleEnv().filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required Google Ads env vars: ${missing.join(', ')}`);
  }

  const slots = await collectSlots();
  const decisions = decideCapacity(slots);
  const accessToken = await googleAccessToken();
  const ads = await collectAdsState(accessToken);
  const guard = evaluateGuards(ads);
  const plan = buildPlan({ ads, decisions, guard });
  const mutations = await executePlan(accessToken, plan);

  const report = {
    generated_at: new Date().toISOString(),
    timezone_note: 'GitHub cron is UTC. 06:00 UTC is 08:00 in Europe/Berlin during summer time.',
    apply: CONFIG.apply,
    max_daily_budget_eur: CONFIG.maxDailyBudgetEur,
    decisions,
    guard,
    plan,
    mutations,
    ads_snapshot: ads,
    slot_summary: summarizeSlots(slots),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    apply: CONFIG.apply,
    report: path.relative(ROOT, reportPath),
    decisions,
    planned_budgets: plan.budgets,
    planned_bid_updates: plan.keywordBidUpdates.length,
    guard,
  }, null, 2));
}

async function collectSlots() {
  const dates = Array.from({ length: CONFIG.lookAheadDays }, (_, i) => dateOnly(addDays(new Date(), i)));
  const rows = [];

  for (const master of MASTERS) {
    for (const service of SERVICES) {
      if (!master.categories.includes(service.category)) continue;
      for (const date of dates) {
        const data = await altegioGet(`book_times/${CONFIG.altegioLocationId}/${master.id}/${date}`, {
          'service_ids[]': service.id,
        });
        const slots = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        rows.push({
          date,
          master_id: master.id,
          master_name: master.name,
          service_id: service.id,
          service_name: service.name,
          category: service.category,
          slots_count: slots.length,
          first_time: slots[0]?.time || '',
          last_time: slots.at(-1)?.time || '',
        });
      }
    }
  }

  return rows;
}

function decideCapacity(rows) {
  const today = dateOnly(new Date());
  const day7 = dateOnly(addDays(new Date(), 6));

  return ['manikuere', 'pedikuere', 'wimpern'].map((category) => {
    const todaySlots = sum(rows.filter((r) => r.category === category && r.date === today), 'slots_count');
    const next7Slots = sum(rows.filter((r) => r.category === category && r.date >= today && r.date <= day7), 'slots_count');
    let mode = 'hold';
    let reason = 'normal capacity';
    if (todaySlots === 0 && next7Slots < 10) {
      mode = 'protect_budget';
      reason = 'low capacity today and next 7 days';
    } else if (todaySlots > 0 && todaySlots <= 6) {
      mode = 'push_mobile_today';
      reason = 'few same-day slots: urgency can work';
    } else if (todaySlots > 6 || next7Slots >= 30) {
      mode = 'push';
      reason = 'enough bookable capacity';
    }
    return { category, today_slots: todaySlots, next_7_days_slots: next7Slots, recommended_mode: mode, reason };
  });
}

async function collectAdsState(accessToken) {
  const campaignIds = Object.values(CAMPAIGNS).map((c) => c.id).join(',');
  const [campaigns, keywords, broadKeywords, conversionGoals] = await Promise.all([
    gadsSearch(accessToken, `
      SELECT campaign.id, campaign.name, campaign.status, campaign.serving_status,
        campaign.primary_status, campaign.primary_status_reasons,
        campaign_budget.resource_name, campaign_budget.amount_micros,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.id IN (${campaignIds}) AND segments.date DURING TODAY
    `),
    gadsSearch(accessToken, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
        ad_group_criterion.resource_name, ad_group_criterion.status,
        ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
        ad_group_criterion.system_serving_status,
        ad_group_criterion.effective_cpc_bid_micros,
        metrics.impressions, metrics.clicks, metrics.cost_micros
      FROM keyword_view
      WHERE campaign.id IN (${CAMPAIGNS.pedikuere.id},${CAMPAIGNS.manikuere.id})
        AND ad_group_criterion.status = ENABLED
    `),
    gadsSearch(accessToken, `
      SELECT campaign.id, campaign.name, ad_group.name,
        ad_group_criterion.resource_name, ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type, ad_group_criterion.status
      FROM keyword_view
      WHERE campaign.id IN (${CAMPAIGNS.pedikuere.id},${CAMPAIGNS.manikuere.id})
        AND ad_group_criterion.status = ENABLED
        AND ad_group_criterion.keyword.match_type = BROAD
    `),
    gadsSearch(accessToken, `
      SELECT campaign.id, campaign.name, campaign_conversion_goal.category,
        campaign_conversion_goal.origin, campaign_conversion_goal.biddable
      FROM campaign_conversion_goal
      WHERE campaign.id IN (${campaignIds})
    `),
  ]);

  return { campaigns, keywords, broadKeywords, conversionGoals };
}

function evaluateGuards(ads) {
  const warnings = [];
  const hardStops = [];

  const broadCount = ads.broadKeywords.length;
  if (broadCount > 0) {
    warnings.push(`${broadCount} enabled broad keywords found. Governor will not increase Search bids until broad is fixed.`);
  }

  for (const row of ads.campaigns) {
    const campaign = row.campaign;
    if (!Object.values(CAMPAIGNS).some((c) => c.id === String(campaign.id))) {
      hardStops.push(`Unexpected campaign in state: ${campaign.id}`);
    }
    if (campaign.status !== 'ENABLED') {
      warnings.push(`${campaign.name} is ${campaign.status}; governor will not enable it.`);
    }
  }

  const softGoals = ads.conversionGoals.filter((row) => {
    const category = row.campaignConversionGoal?.category;
    const origin = row.campaignConversionGoal?.origin;
    return row.campaignConversionGoal?.biddable === true &&
      ((category === 'PAGE_VIEW' && origin === 'WEBSITE') || (category === 'BOOK_APPOINTMENT' && origin === 'WEBSITE'));
  });
  if (softGoals.length) {
    warnings.push(`${softGoals.length} soft website goals are still biddable. Governor will keep budget conservative.`);
  }

  return { hard_stop: hardStops.length > 0, hard_stops: hardStops, warnings };
}

function buildPlan({ ads, decisions, guard }) {
  if (guard.hard_stop) {
    return { reason: 'hard stop', budgets: [], keywordBidUpdates: [] };
  }

  const byCategory = Object.fromEntries(decisions.map((d) => [d.category, d]));
  const desiredBudgets = allocateBudgets(byCategory, guard);
  const currentCampaigns = Object.fromEntries(ads.campaigns.map((row) => [String(row.campaign.id), row]));
  const budgets = Object.entries(desiredBudgets).map(([key, eur]) => {
    const campaign = CAMPAIGNS[key];
    const row = currentCampaigns[campaign.id];
    const currentEur = Number(row?.campaignBudget?.amountMicros || 0) / 1_000_000;
    const cappedEur = clampBudgetDelta(currentEur, eur);
    return {
      key,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      budget_resource_name: row?.campaignBudget?.resourceName,
      current_eur: round2(currentEur),
      target_eur: round2(cappedEur),
      raw_target_eur: round2(eur),
    };
  }).filter((b) => b.budget_resource_name && Math.abs(b.current_eur - b.target_eur) >= 0.01);

  const broadUnsafe = ads.broadKeywords.length > 0;
  const keywordBidUpdates = broadUnsafe ? [] : ads.keywords
    .map((row) => desiredKeywordBid(row, byCategory))
    .filter(Boolean);

  return {
    reason: broadUnsafe ? 'broad keywords present: budget only' : 'capacity-based budget and bid adjustment',
    budgets,
    keywordBidUpdates,
  };
}

function allocateBudgets(byCategory, guard) {
  const manMode = byCategory.manikuere?.recommended_mode || 'hold';
  const pedMode = byCategory.pedikuere?.recommended_mode || 'hold';
  const softGoalPenalty = guard.warnings.some((w) => w.includes('soft website goals'));

  let budgets = { pmax: 8, manikuere: 8, pedikuere: 6 };

  if (manMode === 'push' && pedMode === 'push_mobile_today') budgets = { pmax: 8, manikuere: 12, pedikuere: 10 };
  else if (manMode === 'push' && pedMode === 'push') budgets = { pmax: 8, manikuere: 11, pedikuere: 11 };
  else if (manMode.startsWith('protect') && pedMode.startsWith('push')) budgets = { pmax: 8, manikuere: 2, pedikuere: 14 };
  else if (pedMode.startsWith('protect') && manMode.startsWith('push')) budgets = { pmax: 8, manikuere: 14, pedikuere: 2 };
  else if (manMode.startsWith('protect') && pedMode.startsWith('protect')) budgets = { pmax: 6, manikuere: 2, pedikuere: 2 };

  if (softGoalPenalty) budgets.pmax = Math.min(budgets.pmax, 8);

  budgets.pmax = clamp(budgets.pmax, CAMPAIGNS.pmax.minBudget, CAMPAIGNS.pmax.maxBudget);
  budgets.manikuere = clamp(budgets.manikuere, CAMPAIGNS.manikuere.minBudget, CAMPAIGNS.manikuere.maxBudget);
  budgets.pedikuere = clamp(budgets.pedikuere, CAMPAIGNS.pedikuere.minBudget, CAMPAIGNS.pedikuere.maxBudget);

  const total = budgets.pmax + budgets.manikuere + budgets.pedikuere;
  if (total > CONFIG.maxDailyBudgetEur) {
    const scale = CONFIG.maxDailyBudgetEur / total;
    budgets = Object.fromEntries(Object.entries(budgets).map(([k, v]) => [k, Math.max(CAMPAIGNS[k].minBudget, Math.floor(v * scale))]));
  }
  return budgets;
}

function desiredKeywordBid(row, byCategory) {
  const campaignId = String(row.campaign.id);
  const category = campaignId === CAMPAIGNS.manikuere.id ? 'manikuere' :
    campaignId === CAMPAIGNS.pedikuere.id ? 'pedikuere' : null;
  if (!category) return null;

  const mode = byCategory[category]?.recommended_mode || 'hold';
  const match = row.adGroupCriterion.keyword.matchType;
  if (!['EXACT', 'PHRASE'].includes(match)) return null;

  const current = Number(row.adGroupCriterion.effectiveCpcBidMicros || 0) / 1_000_000;
  const targetRaw = SEARCH_BID_RULES[category][mode][match.toLowerCase()];
  const target = clampBidDelta(current, targetRaw);
  if (Math.abs(current - target) < 0.01) return null;

  return {
    campaign_id: campaignId,
    campaign_name: row.campaign.name,
    ad_group_name: row.adGroup.name,
    criterion_resource_name: row.adGroupCriterion.resourceName,
    keyword: row.adGroupCriterion.keyword.text,
    match_type: match,
    current_eur: round2(current),
    target_eur: round2(target),
    raw_target_eur: round2(targetRaw),
  };
}

async function executePlan(accessToken, plan) {
  const mutations = { budgets: [], keyword_bids: [] };
  if (!CONFIG.apply) return { skipped: 'dry_run', ...mutations };
  if (plan.reason === 'hard stop') return { skipped: 'hard_stop', ...mutations };

  if (plan.budgets.length) {
    const operations = plan.budgets.map((b) => ({
      update: { resourceName: b.budget_resource_name, amountMicros: String(Math.round(b.target_eur * 1_000_000)) },
      updateMask: 'amount_micros',
    }));
    mutations.budgets = await googleMutate(accessToken, 'campaignBudgets', operations);
  }

  if (plan.keywordBidUpdates.length) {
    const operations = plan.keywordBidUpdates.map((b) => ({
      update: { resourceName: b.criterion_resource_name, cpcBidMicros: String(Math.round(b.target_eur * 1_000_000)) },
      updateMask: 'cpc_bid_micros',
    }));
    mutations.keyword_bids = await googleMutate(accessToken, 'adGroupCriteria', operations);
  }

  return mutations;
}

async function altegioGet(altegioPath, query) {
  const url = new URL(CONFIG.altegioProxyBase);
  url.searchParams.set('path', altegioPath);
  for (const [key, value] of Object.entries(query || {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) url.searchParams.append(key, String(item));
  }

  const res = await fetch(url, { headers: { Accept: 'application/vnd.api.v2+json' } });
  if (!res.ok) throw new Error(`Altegio ${res.status} for ${altegioPath}`);
  return res.json();
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

async function googleMutate(accessToken, service, operations) {
  const url = `https://googleads.googleapis.com/${CONFIG.google.apiVersion}/customers/${CONFIG.google.customerId}/${service}:mutate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: googleHeaders(accessToken),
    body: JSON.stringify({ operations, partialFailure: false }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Ads mutate ${service} failed: ${JSON.stringify(data)}`);
  return data;
}

function googleHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': CONFIG.google.developerToken,
    'login-customer-id': CONFIG.google.loginCustomerId,
    'Content-Type': 'application/json',
  };
}

function summarizeSlots(rows) {
  const summary = {};
  for (const row of rows) {
    const key = `${row.category}:${row.date}`;
    summary[key] ||= { category: row.category, date: row.date, slots_count: 0, masters_with_slots: [] };
    summary[key].slots_count += row.slots_count;
    if (row.slots_count > 0 && !summary[key].masters_with_slots.includes(row.master_name)) {
      summary[key].masters_with_slots.push(row.master_name);
    }
  }
  return Object.values(summary).sort((a, b) => `${a.category}${a.date}`.localeCompare(`${b.category}${b.date}`));
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

function envNumber(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampBudgetDelta(current, target) {
  if (!current) return target;
  return round2(clamp(target, current - 5, current + 5));
}

function clampBidDelta(current, target) {
  if (!current) return target;
  return round2(clamp(target, current - 0.15, current + 0.15));
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function isoStamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}
