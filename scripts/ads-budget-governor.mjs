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
  reportEveryHours: envNumber('ADS_GOVERNOR_REPORT_EVERY_HOURS', 3),
  forceTelegram: envBool('ADS_GOVERNOR_FORCE_TELEGRAM', false),
  reportMode: env('ADS_GOVERNOR_REPORT_MODE', ''),
  altegioProxyBase: env('ALTEGIO_PROXY_BASE', 'https://crocus-proxy.crocusbeautystudio.workers.dev/api/proxy'),
  altegioLocationId: env('ALTEGIO_LOCATION_ID', '1357963'),
  telegram: {
    botToken: env('TELEGRAM_BOT_TOKEN'),
    chatId: env('TELEGRAM_CHAT_ID'),
  },
  openai: {
    apiKey: env('OPENAI_API_KEY'),
    projectId: env('OPENAI_PROJECT_ID'),
    model: env('OPENAI_MODEL', 'gpt-4o-mini'),
  },
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
    push: { exact: 0.75, phrase: 0.45 },
    push_mobile_today: { exact: 0.65, phrase: 0.40 },
    hold: { exact: 0.45, phrase: 0.30 },
    protect_budget: { exact: 0.20, phrase: 0.15 },
  },
  pedikuere: {
    push: { exact: 0.42, phrase: 0.28 },
    push_mobile_today: { exact: 0.38, phrase: 0.25 },
    hold: { exact: 0.26, phrase: 0.18 },
    protect_budget: { exact: 0.18, phrase: 0.12 },
  },
};

const REPORT_DIR = path.join(ROOT, 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const now = new Date();
const runId = isoStamp(now);
const reportPath = path.join(REPORT_DIR, `ads-governor-${runId}.json`);
const reportMdPath = path.join(REPORT_DIR, `ads-governor-${runId}.md`);

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
  const performance = await collectPerformance(accessToken);
  const billing = await collectBilling(accessToken);
  const guard = evaluateGuards(ads);
  const plan = buildPlan({ ads, decisions, guard, performance });
  const mutations = await executePlan(accessToken, plan);

  const report = {
    generated_at: new Date().toISOString(),
    report_kind: reportKind(now),
    timezone_note: 'GitHub cron is UTC. 06:00 UTC is 08:00 in Europe/Berlin during summer time.',
    apply: CONFIG.apply,
    max_daily_budget_eur: CONFIG.maxDailyBudgetEur,
    decisions,
    guard,
    plan,
    mutations,
    performance,
    billing,
    ads_snapshot: ads,
    slot_summary: summarizeSlots(slots),
    master_capacity_today: summarizeTodayMasters(slots),
  };
  report.ai_analysis = await collectAiAnalysis(report);

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  const markdown = renderMarkdownReport(report);
  fs.writeFileSync(reportMdPath, markdown);
  const telegram = shouldSendTelegram(report)
    ? await sendTelegramReport(renderTelegramSummary(report))
    : { skipped: `not_report_hour_every_${CONFIG.reportEveryHours}h` };
  console.log(JSON.stringify({
    ok: true,
    apply: CONFIG.apply,
    report: path.relative(ROOT, reportPath),
    markdown_report: path.relative(ROOT, reportMdPath),
    telegram,
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
        const slotHours = uniqueSlotHours(slots);
        rows.push({
          date,
          master_id: master.id,
          master_name: master.name,
          service_id: service.id,
          service_name: service.name,
          category: service.category,
          raw_slots_count: slots.length,
          slots_count: slotHours.length,
          slot_hours: slotHours,
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
    const todaySlots = countSlotWindows(rows, (r) => r.category === category && r.date === today);
    const next7Slots = countSlotWindows(rows, (r) => r.category === category && r.date >= today && r.date <= day7);
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

async function collectPerformance(accessToken) {
  const campaignIds = Object.values(CAMPAIGNS).map((c) => c.id).join(',');
  const today = dateOnly(new Date());
  const yesterday = dateOnly(addDays(new Date(), -1));
  const last7Start = dateOnly(addDays(new Date(), -6));
  const last30Start = dateOnly(addDays(new Date(), -29));
  const monthStart = today.slice(0, 8) + '01';
  const rows = await gadsSearch(accessToken, `
    SELECT segments.date, campaign.id, campaign.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE campaign.id IN (${campaignIds})
      AND segments.date BETWEEN '${yesterday}' AND '${today}'
    ORDER BY segments.date DESC, campaign.id
  `);

  const byDate = {};
  for (const row of rows) {
    const date = row.segments.date;
    byDate[date] ||= { date, campaigns: [], totals: emptyMetrics() };
    const metrics = normalizeMetrics(row.metrics);
    byDate[date].campaigns.push({
      campaign_id: String(row.campaign.id),
      campaign_name: row.campaign.name,
      ...metrics,
    });
    addMetrics(byDate[date].totals, metrics);
  }
  const [last7, last30, monthToDate, searchTerms, hourly] = await Promise.all([
    collectPerformanceRange(accessToken, campaignIds, last7Start, today, 'last_7_days'),
    collectPerformanceRange(accessToken, campaignIds, last30Start, today, 'last_30_days'),
    collectPerformanceRange(accessToken, campaignIds, monthStart, today, 'month_to_date'),
    collectSearchTermInsights(accessToken, last7Start, today),
    collectHourlyPerformance(accessToken, campaignIds, last30Start, today),
  ]);
  return {
    daily: Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)),
    last_7_days: last7,
    last_30_days: last30,
    month_to_date: monthToDate,
    search_terms: searchTerms,
    hourly,
  };
}

async function collectPerformanceRange(accessToken, campaignIds, start, end, label) {
  const rows = await gadsSearch(accessToken, `
    SELECT campaign.id, campaign.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE campaign.id IN (${campaignIds})
      AND segments.date BETWEEN '${start}' AND '${end}'
  `);
  const totals = emptyMetrics();
  const campaigns = [];
  for (const row of rows) {
    const metrics = normalizeMetrics(row.metrics);
    campaigns.push({ campaign_id: String(row.campaign.id), campaign_name: row.campaign.name, ...metrics });
    addMetrics(totals, metrics);
  }
  return { label, start, end, totals, campaigns };
}

async function collectSearchTermInsights(accessToken, start, end) {
  const rows = await gadsSearch(accessToken, `
    SELECT campaign.id, campaign.name, ad_group.name, search_term_view.search_term,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM search_term_view
    WHERE campaign.id IN (${CAMPAIGNS.pedikuere.id},${CAMPAIGNS.manikuere.id})
      AND segments.date BETWEEN '${start}' AND '${end}'
      AND metrics.clicks > 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 40
  `);

  const terms = rows.map((row) => {
    const metrics = normalizeMetrics(row.metrics);
    const intent = classifySearchTerm(row.searchTermView?.searchTerm || '');
    return {
      campaign_id: String(row.campaign.id),
      campaign_name: row.campaign.name,
      ad_group_name: row.adGroup?.name || '',
      term: row.searchTermView?.searchTerm || '',
      intent,
      ...metrics,
      cpc_eur: avgCost(metrics),
      cpl_eur: metrics.conversions > 0 ? round2(metrics.cost_eur / metrics.conversions) : null,
    };
  });

  return {
    start,
    end,
    top_spend: terms.slice(0, 10),
    risky: terms.filter((t) => t.intent.risk !== 'ok').slice(0, 10),
    winners: terms.filter((t) => t.conversions > 0).sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks).slice(0, 10),
  };
}

async function collectHourlyPerformance(accessToken, campaignIds, start, end) {
  const rows = await gadsSearch(accessToken, `
    SELECT segments.hour, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM campaign
    WHERE campaign.id IN (${campaignIds})
      AND segments.date BETWEEN '${start}' AND '${end}'
    ORDER BY segments.hour
  `);
  const byHour = {};
  for (const row of rows) {
    const hour = Number(row.segments.hour);
    byHour[hour] ||= { hour, ...emptyMetrics() };
    addMetrics(byHour[hour], normalizeMetrics(row.metrics));
  }
  const hours = Object.values(byHour).map((item) => ({
    ...item,
    cpc_eur: avgCost(item),
    cpl_eur: item.conversions > 0 ? round2(item.cost_eur / item.conversions) : null,
    ctr: ctr(item),
    conversion_rate: conversionRate(item),
  }));
  return {
    start,
    end,
    best: hours.filter((h) => h.conversions > 0).sort((a, b) => (a.cpl_eur ?? 9999) - (b.cpl_eur ?? 9999)).slice(0, 5),
    waste: hours.filter((h) => h.clicks >= 3 && h.conversions === 0).sort((a, b) => b.cost_eur - a.cost_eur).slice(0, 5),
  };
}

async function collectBilling(accessToken) {
  const result = { source: 'Google Ads API', billing_setups: [], account_budgets: [], note: '' };
  try {
    result.billing_setups = await gadsSearch(accessToken, `
      SELECT billing_setup.id, billing_setup.status,
        billing_setup.payments_account_info.payments_account_id,
        billing_setup.payments_account_info.payments_account_name,
        billing_setup.payments_account_info.payments_profile_id,
        billing_setup.payments_account_info.payments_profile_name
      FROM billing_setup
    `);
  } catch (error) {
    result.billing_setups_error = error.message;
  }
  try {
    result.account_budgets = await gadsSearch(accessToken, `
      SELECT account_budget.status,
        account_budget.approved_spending_limit_micros,
        account_budget.adjusted_spending_limit_micros,
        account_budget.amount_served_micros,
        account_budget.approved_start_date_time,
        account_budget.approved_end_date_time
      FROM account_budget
    `);
  } catch (error) {
    result.account_budgets_error = error.message;
  }
  result.note = 'Exact amount due and payment due date may require Google Ads UI or invoice access.';
  return result;
}

async function collectAiAnalysis(report) {
  if (!CONFIG.openai.apiKey) {
    return { skipped: 'OPENAI_API_KEY is not configured in GitHub Actions secrets' };
  }
  if (!['daily', 'manual'].includes(report.report_kind)) {
    return { skipped: 'AI analysis is reserved for daily and manual reports to protect free-tier budget' };
  }

  const compact = {
    generated_at: report.generated_at,
    report_kind: report.report_kind,
    apply: report.apply,
    budget_cap_eur: report.max_daily_budget_eur,
    capacity_decisions: report.decisions,
    guard: report.guard,
    plan: {
      reason: report.plan.reason,
      budgets: report.plan.budgets.map((b) => ({
        campaign: shortCampaign(b.campaign_name),
        current_eur: b.current_eur,
        target_eur: b.target_eur,
      })),
      bid_updates_count: report.plan.keywordBidUpdates.length,
      bid_update_examples: report.plan.keywordBidUpdates.slice(0, 8).map((b) => ({
        campaign: shortCampaign(b.campaign_name),
        keyword: b.keyword,
        match_type: b.match_type,
        current_eur: b.current_eur,
        target_eur: b.target_eur,
      })),
    },
    performance: {
      today: report.performance.daily?.[0] || null,
      last_7_days: report.performance.last_7_days?.totals || null,
      last_30_days: report.performance.last_30_days?.totals || null,
      campaigns_7d: (report.performance.last_7_days?.campaigns || []).map((c) => ({
        campaign: shortCampaign(c.campaign_name),
        impressions: c.impressions,
        clicks: c.clicks,
        cost_eur: round2(c.cost_eur),
        conversions: round2(c.conversions),
        cpc_eur: avgCost(c),
        cpl_eur: c.conversions > 0 ? round2(c.cost_eur / c.conversions) : null,
      })),
      risky_search_terms: report.performance.search_terms?.risky?.slice(0, 8) || [],
      winning_search_terms: report.performance.search_terms?.winners?.slice(0, 8) || [],
      best_hours_30d: report.performance.hourly?.best || [],
      waste_hours_30d: report.performance.hourly?.waste || [],
    },
  };

  const system = [
    'You are a senior performance marketing operator for Crocus Beauty Studio in Goeppingen.',
    'Write in Russian. Be brutally practical and concise.',
    'Goal: spend less, get more real bookings. Budget cap is strict.',
    'Use only the provided data. Never invent conversions, spend, audiences, billing, or slot availability.',
    'Explain actions in owner-friendly language: what happened, why, what will be done, what will not be done, risk.',
    'Do not recommend broad keywords, blind city expansion, fake soft conversions, or frequent destructive campaign resets.',
    'Respect slot-aware logic: no slots means protect budget; enough slots means cautious push.',
    'Return plain text only, max 900 characters.',
  ].join('\n');

  const user = [
    'Analyze this Google Ads + Altegio snapshot for Crocus.',
    'Give: 1) main situation, 2) what to do/avoid, 3) why, 4) next check.',
    JSON.stringify(compact),
  ].join('\n\n');

  try {
    const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.openai.apiKey}`,
        'Content-Type': 'application/json',
        ...(CONFIG.openai.projectId ? { 'OpenAI-Project': CONFIG.openai.projectId } : {}),
      },
      body: JSON.stringify({
        model: CONFIG.openai.model,
        temperature: 0.25,
        max_tokens: 450,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error?.message || `OpenAI ${res.status}` };
    return { ok: true, model: CONFIG.openai.model, text: String(data.choices?.[0]?.message?.content || '').slice(0, 1200) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
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

function buildPlan({ ads, decisions, guard, performance }) {
  if (guard.hard_stop) {
    return { reason: 'hard stop', budgets: [], keywordBidUpdates: [] };
  }

  const byCategory = Object.fromEntries(decisions.map((d) => [d.category, d]));
  const performanceRisk = evaluatePerformanceRisk(performance);
  const desiredBudgets = allocateBudgets(byCategory, guard, performanceRisk);
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
    .map((row) => desiredKeywordBid(row, byCategory, performanceRisk))
    .filter(Boolean);

  return {
    reason: broadUnsafe ? 'broad keywords present: budget only' : 'capacity-based budget and bid adjustment',
    budgets,
    keywordBidUpdates,
    performance_risk: performanceRisk,
  };
}

function allocateBudgets(byCategory, guard, performanceRisk) {
  const manMode = byCategory.manikuere?.recommended_mode || 'hold';
  const pedMode = byCategory.pedikuere?.recommended_mode || 'hold';
  const softGoalPenalty = guard.warnings.some((w) => w.includes('soft website goals'));

  let budgets = { pmax: 8, manikuere: 8, pedikuere: 6 };

  if (manMode === 'push_mobile_today' && pedMode === 'push_mobile_today') budgets = { pmax: 6, manikuere: 14, pedikuere: 5 };
  else if (manMode === 'push' && pedMode === 'push_mobile_today') budgets = { pmax: 6, manikuere: 14, pedikuere: 6 };
  else if (manMode === 'push' && pedMode === 'push') budgets = { pmax: 6, manikuere: 14, pedikuere: 8 };
  else if (manMode.startsWith('protect') && pedMode.startsWith('push')) budgets = { pmax: 8, manikuere: 2, pedikuere: 14 };
  else if (pedMode.startsWith('protect') && manMode.startsWith('push')) budgets = { pmax: 8, manikuere: 14, pedikuere: 2 };
  else if (manMode.startsWith('protect') && pedMode.startsWith('protect')) budgets = { pmax: 6, manikuere: 2, pedikuere: 2 };

  if (softGoalPenalty) budgets.pmax = Math.min(budgets.pmax, 8);
  for (const [key, risk] of Object.entries(performanceRisk || {})) {
    if (risk.level === 'poor' && key in budgets) {
      budgets[key] = Math.min(budgets[key], risk.current_budget_hint_eur || 5);
    }
  }

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

function desiredKeywordBid(row, byCategory, performanceRisk) {
  const campaignId = String(row.campaign.id);
  const category = campaignId === CAMPAIGNS.manikuere.id ? 'manikuere' :
    campaignId === CAMPAIGNS.pedikuere.id ? 'pedikuere' : null;
  if (!category) return null;

  const mode = byCategory[category]?.recommended_mode || 'hold';
  const match = row.adGroupCriterion.keyword.matchType;
  if (!['EXACT', 'PHRASE'].includes(match)) return null;

  const current = Number(row.adGroupCriterion.effectiveCpcBidMicros || 0) / 1_000_000;
  const risk = performanceRisk?.[category];
  const effectiveMode = risk?.level === 'poor' && mode.startsWith('push') ? 'hold' : mode;
  const targetRaw = SEARCH_BID_RULES[category][effectiveMode][match.toLowerCase()];
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

  const res = await fetchWithRetry(url, { headers: { Accept: 'application/vnd.api.v2+json' } });
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
  const res = await fetchWithRetry('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth failed: ${data.error || res.status}`);
  return data.access_token;
}

async function gadsSearch(accessToken, query) {
  const url = `https://googleads.googleapis.com/${CONFIG.google.apiVersion}/customers/${CONFIG.google.customerId}/googleAds:searchStream`;
  const res = await fetchWithRetry(url, {
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
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: googleHeaders(accessToken),
    body: JSON.stringify({ operations, partialFailure: false }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Ads mutate ${service} failed: ${JSON.stringify(data)}`);
  return data;
}

function renderMarkdownReport(report) {
  return renderTelegramSummary(report);
}

function renderTelegramSummary(report) {
  const today = dateOnly(new Date());
  const yesterday = dateOnly(addDays(new Date(), -1));
  const perfByDate = Object.fromEntries((report.performance?.daily || []).map((item) => [item.date, item]));
  const todayPerf = perfByDate[today]?.totals || emptyMetrics();
  const yesterdayPerf = perfByDate[yesterday]?.totals || emptyMetrics();
  const last7 = report.performance?.last_7_days?.totals || emptyMetrics();
  const last30 = report.performance?.last_30_days?.totals || emptyMetrics();
  const mtd = report.performance?.month_to_date?.totals || emptyMetrics();
  const slotLines = report.decisions.map((d) =>
    `${modeIcon(d.recommended_mode)} ${ruCategory(d.category)}: ${d.today_slots} ${R('hour_windows_today')} / ${d.next_7_days_slots} ${R('hour_windows_next7')} -> ${ruMode(d.recommended_mode)} (${ruReason(d.reason)})`
  );
  const masterLines = masterCapacityLines(report.master_capacity_today || []);
  const todayCpl = cplText(todayPerf);
  const yesterdayCpl = cplText(yesterdayPerf);
  const health = report.guard.hard_stop ? R('health_stop') : report.guard.warnings.length ? R('health_warn') : R('health_ok');
  const didText = report.apply
    ? R('did_apply', { budgets: report.plan.budgets.length, bids: report.plan.keywordBidUpdates.length })
    : R('did_dryrun', { budgets: report.plan.budgets.length, bids: report.plan.keywordBidUpdates.length });
  const meaning = meaningText(report);
  const detailed = report.report_kind === 'daily' || report.report_kind === 'manual';
  const search = report.performance?.search_terms || {};
  const hourly = report.performance?.hourly || {};
  const campaignLines = campaignPerformanceLines(report.performance?.last_7_days?.campaigns || []);
  const planLines = actionPlanLines(report);
  const riskyLines = riskyTermLines(search.risky || []);
  const winnerLines = winnerTermLines(search.winners || []);
  const hourLines = hourInsightLines(hourly);

  return [
    `${detailed ? R('title_deep') : R('title_ops')}`,
    summaryHero(report, { todayPerf, yesterdayPerf, last7 }),
    '',
    card(R('block_money'), [moneyPulse(todayPerf, yesterdayPerf, last7, report.max_daily_budget_eur)]),
    '',
    masterLines.length ? card(R('block_masters'), masterLines) : '',
    '',
    card(R('block_slots'), slotLines),
    '',
    card(R('block_decision'), [
      meaning,
      nextStepText(report),
      decisionDisciplineText(report),
    ]),
    '',
    card(R('block_actions'), [
      didText,
      ...humanPlanLines(report),
    ]),
    detailed && campaignLines.length ? card(R('block_campaigns'), campaignLines) : '',
    detailed && (riskyLines.length || winnerLines.length) ? card(R('block_terms'), [
      ...winnerLines,
      ...riskyLines,
    ]) : '',
    detailed && hourLines.length ? card(R('block_hours'), hourLines) : '',
    report.ai_analysis?.text ? card(R('block_ai'), [report.ai_analysis.text]) : '',
  ].flat().filter(Boolean).join('\n\n');
}

async function sendTelegramReport(text) {
  if (!CONFIG.telegram.botToken || !CONFIG.telegram.chatId) return { skipped: 'telegram_not_configured' };

  const url = `https://api.telegram.org/bot${CONFIG.telegram.botToken}/sendMessage`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CONFIG.telegram.chatId,
      text: text.slice(0, 3900),
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: data.description || 'telegram_send_failed' };
  return { ok: true };
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await sleep(750 * (i + 1));
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function metricRow(label, metrics) {
  const cpl = metrics.conversions > 0 ? `${round2(metrics.cost_eur / metrics.conversions)} EUR` : '-';
  return `| ${label} | ${metrics.impressions} | ${metrics.clicks} | ${round2(metrics.cost_eur)} EUR | ${round2(metrics.conversions)} | ${cpl} |`;
}

function card(title, lines) {
  const clean = lines.filter(Boolean);
  if (!clean.length) return '';
  return [`${title}`, ...clean.map((line) => `â€¢ ${line}`)].join('\n');
}

function campaignPerformanceLines(campaigns) {
  return campaigns
    .slice()
    .sort((a, b) => b.cost_eur - a.cost_eur)
    .map((c) => {
      const cpc = avgCost(c);
      const cpl = c.conversions > 0 ? `${round2(c.cost_eur / c.conversions)} EUR` : '-';
      return `${humanCampaign(c.campaign_name)}: ${round2(c.cost_eur)} EUR, ${c.clicks} clicks, ${round2(c.conversions)} conv, CPC ${cpc} EUR, CPL ${cpl}.`;
    })
    .slice(0, 4);
}

function actionPlanLines(report) {
  const lines = [];
  if (report.plan.reason) lines.push(`${R('why')}: ${ruPlanReason(report.plan.reason)}.`);
  for (const budget of report.plan.budgets.slice(0, 4)) {
    lines.push(`${shortCampaign(budget.campaign_name)}: ${budget.current_eur} -> ${budget.target_eur} EUR/day.`);
  }
  if (report.plan.keywordBidUpdates.length) {
    const examples = report.plan.keywordBidUpdates.slice(0, 3).map((b) => `${b.keyword} ${b.current_eur}->${b.target_eur}`);
    lines.push(`${R('bids')}: ${examples.join('; ')}.`);
  }
  if (!report.plan.budgets.length && !report.plan.keywordBidUpdates.length) {
    lines.push(R('no_live_changes_needed'));
  }
  return lines;
}

function evaluatePerformanceRisk(performance) {
  const result = {};
  const campaigns = performance?.last_7_days?.campaigns || [];
  for (const row of campaigns) {
    const key = campaignKey(row.campaign_name);
    if (!key || key === 'pmax') continue;
    const cpl = row.conversions > 0 ? row.cost_eur / row.conversions : null;
    let level = 'ok';
    let reason = 'performance is acceptable';
    if (row.cost_eur >= 15 && row.conversions === 0) {
      level = 'poor';
      reason = 'spent meaningful budget with zero conversions in the last 7 days';
    } else if (cpl != null && cpl > 12) {
      level = 'watch';
      reason = 'CPL is above target';
    }
    result[key] = {
      level,
      reason,
      last_7_days_cost_eur: round2(row.cost_eur),
      last_7_days_clicks: row.clicks,
      last_7_days_conversions: round2(row.conversions),
      cpl_eur: cpl == null ? null : round2(cpl),
      current_budget_hint_eur: level === 'poor' ? 5 : undefined,
    };
  }
  return result;
}

function humanPlanLines(report) {
  const lines = [];
  for (const budget of report.plan.budgets.slice(0, 4)) {
    const diff = round2(budget.target_eur - budget.current_eur);
    if (diff > 0) {
      lines.push(`${humanCampaign(budget.campaign_name)}: add ${diff} EUR/day because slots and performance allow it.`);
    } else if (diff < 0) {
      lines.push(`${humanCampaign(budget.campaign_name)}: cut ${Math.abs(diff)} EUR/day to stop feeding weak traffic.`);
    } else {
      lines.push(`${humanCampaign(budget.campaign_name)}: keep as is.`);
    }
  }
  const risks = Object.entries(report.plan.performance_risk || {})
    .filter(([, risk]) => risk.level === 'poor')
    .map(([key]) => ruCategory(key));
  if (risks.length) {
    lines.push(`${risks.join(', ')}: slots exist, but ads performance is weak, so only controlled test, no aggressive push.`);
  }
  if (!lines.length) lines.push(R('no_live_changes_needed'));
  return lines;
}

function summaryHero(report, { todayPerf, yesterdayPerf, last7 }) {
  const status = report.guard.hard_stop ? 'RED STOP: do not touch ads' : report.guard.warnings.length ? 'YELLOW: caution, warnings exist' : 'GREEN: can work';
  const action = report.apply ? 'changes are being applied' : 'dry-run, money not touched';
  const main = nextStepText(report);
  return [
    status,
    `Today: ${round2(todayPerf.cost_eur)} EUR, ${todayPerf.clicks} clicks, ${round2(todayPerf.conversions)} conv.`,
    `Yesterday: ${round2(yesterdayPerf.cost_eur)} EUR, ${round2(yesterdayPerf.conversions)} conv, CPL ${cplText(yesterdayPerf)}.`,
    `7 days: ${round2(last7.cost_eur)} EUR, ${round2(last7.conversions)} conv, CPL ${cplText(last7)}.`,
    `Decision: ${main}. Now: ${action}.`,
  ].join('\n');
}

function moneyPulse(todayPerf, yesterdayPerf, last7, limit) {
  const todayShare = limit > 0 ? round2((todayPerf.cost_eur / limit) * 100) : 0;
  return `limit ${limit} EUR/day; today spent ${round2(todayPerf.cost_eur)} EUR (${todayShare}% of cap); yesterday CPL ${cplText(yesterdayPerf)}; 7-day CPL ${cplText(last7)}.`;
}

function masterCapacityLines(rows) {
  return rows
    .filter((row) => ['manikuere', 'pedikuere'].includes(row.category))
    .sort((a, b) => b.windows - a.windows || a.master_name.localeCompare(b.master_name))
    .slice(0, 8)
    .map((row) => {
      const status = row.windows === 0 ? R('full') : row.windows <= 2 ? R('few_windows') : R('has_windows');
      const hours = row.hours.slice(0, 4).join(', ');
      const tail = row.hours.length > 4 ? ` +${row.hours.length - 4}` : '';
      return `${capacityIcon(row.windows)} ${row.master_name}, ${ruCategory(row.category)}: ${status}${row.windows ? ` (${hours}${tail})` : ''}`;
    });
}

function riskyTermLines(terms) {
  return terms.slice(0, 5).map((t) =>
    `${R('risk')}: "${t.term}" (${ruIntent(t.intent.reason)}), ${round2(t.cost_eur)} EUR, ${t.clicks} clicks, ${round2(t.conversions)} conv.`
  );
}

function winnerTermLines(terms) {
  return terms.slice(0, 4).map((t) =>
    `${R('winner')}: "${t.term}", ${round2(t.conversions)} conv, CPL ${t.cpl_eur ?? '-'} EUR.`
  );
}

function hourInsightLines(hourly) {
  const lines = [];
  if (hourly?.best?.length) {
    lines.push(`${R('best_hours')}: ${hourly.best.map((h) => `${padHour(h.hour)} (${h.conversions} conv, CPL ${h.cpl_eur} EUR)`).join(', ')}.`);
  }
  if (hourly?.waste?.length) {
    lines.push(`${R('waste_hours')}: ${hourly.waste.map((h) => `${padHour(h.hour)} (${round2(h.cost_eur)} EUR, 0 conv)`).join(', ')}.`);
  }
  return lines;
}

function decisionDisciplineText(report) {
  if (report.apply) return R('discipline_apply');
  return R('discipline_dry');
}

function capacityIcon(windows) {
  if (windows === 0) return '\u{1F534}';
  if (windows <= 2) return '\u{1F7E1}';
  return '\u{1F7E2}';
}

function cplText(metrics) {
  return metrics.conversions > 0 ? `${round2(metrics.cost_eur / metrics.conversions)} EUR` : '-';
}

function avgCost(metrics) {
  return metrics.clicks > 0 ? round2(metrics.cost_eur / metrics.clicks) : 0;
}

function ctr(metrics) {
  return metrics.impressions > 0 ? round2((metrics.clicks / metrics.impressions) * 100) : 0;
}

function conversionRate(metrics) {
  return metrics.clicks > 0 ? round2((metrics.conversions / metrics.clicks) * 100) : 0;
}

function uniqueSlotHours(slots) {
  const hours = new Set();
  for (const slot of slots || []) {
    const value = String(slot?.time || slot?.datetime || slot?.date || '').trim();
    const match = value.match(/(\d{1,2}):(\d{2})/);
    if (!match) continue;
    hours.add(`${String(Number(match[1])).padStart(2, '0')}:00`);
  }
  return [...hours].sort();
}

function padHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function reportKind(date) {
  if (CONFIG.reportMode === 'small') return 'ops';
  if (CONFIG.reportMode === 'deep') return 'manual';
  if (CONFIG.forceTelegram) return 'manual';
  const local = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  return local.getHours() === 8 ? 'daily' : 'ops';
}

function classifySearchTerm(term) {
  const normalized = term.toLowerCase();
  const badPatterns = [
    { pattern: /podolog|podologie|medizinisch|arzt|krankenkasse|diabet/i, reason: 'medical/podology intent' },
    { pattern: /ausbildung|kurs|schule|job|stellenangebot/i, reason: 'education/job intent' },
    { pattern: /bilder|foto|fotos|design|ideen|pinterest|vorlage/i, reason: 'inspiration/Pinterest intent' },
    { pattern: /gratis|kostenlos|billig|set kaufen|amazon|dm |rossmann/i, reason: 'low purchase or retail intent' },
  ];
  const hit = badPatterns.find((item) => item.pattern.test(normalized));
  if (hit) return { risk: 'risky', reason: hit.reason };
  if (/manik|nagel|pedik|fuss|fusspflege|gellack|shellac/i.test(normalized)) {
    return { risk: 'ok', reason: 'service intent' };
  }
  return { risk: 'unknown', reason: 'unclear intent' };
}

function modeIcon(mode) {
  const map = {
    push: '\u{1F7E2}',
    push_mobile_today: '\u{1F7E1}',
    hold: '\u{26AA}',
    protect_budget: '\u{1F534}',
  };
  return map[mode] || '\u{26AA}';
}

function shortCampaign(name) {
  if (name.includes('Manik')) return 'manikuere';
  if (name.includes('Pedik')) return 'pedikuere';
  if (name.includes('PMax')) return 'pmax';
  return name;
}

function campaignKey(name) {
  const normalized = String(name || '').toLowerCase();
  if (normalized.includes('manik')) return 'manikuere';
  if (normalized.includes('pedik')) return 'pedikuere';
  if (normalized.includes('pmax')) return 'pmax';
  return '';
}

function humanCampaign(name) {
  const key = campaignKey(name);
  if (key === 'manikuere') return 'Manicure Search';
  if (key === 'pedikuere') return 'Pedicure Search';
  if (key === 'pmax') return 'PMax / Maps / brand';
  return name;
}

function ruCategory(value) {
  const map = { pmax: 'PMax', manikuere: R('manicure'), pedikuere: R('pedicure'), wimpern: R('lashes') };
  return map[value] || value;
}

function ruMode(value) {
  const map = { push: R('push'), push_mobile_today: R('push_mobile_today'), hold: R('hold'), protect_budget: R('protect_budget') };
  return map[value] || value;
}

function ruReason(value) {
  const map = {
    'enough bookable capacity': R('reason_enough_slots'),
    'few same-day slots: urgency can work': R('reason_urgency'),
    'low capacity today and next 7 days': R('reason_low_slots'),
    'normal capacity': R('reason_normal'),
  };
  return map[value] || value;
}

function ruIntent(value) {
  const map = {
    'medical/podology intent': 'medical/podology intent',
    'education/job intent': 'education/job intent',
    'inspiration/Pinterest intent': 'inspiration/Pinterest intent',
    'low purchase or retail intent': 'low purchase/retail intent',
    'service intent': 'service intent',
    'unclear intent': 'unclear intent',
  };
  return map[value] || value;
}

function ruPlanReason(value) {
  const map = {
    'capacity-based budget and bid adjustment': R('plan_by_slots'),
    'broad keywords present: budget only': R('plan_broad'),
    'hard stop': R('plan_stop'),
  };
  return map[value] || value;
}

function ruSkipped(value) {
  const map = { dry_run: R('dry_run_full'), hard_stop: R('plan_stop') };
  return map[value] || value;
}

function billingDueText(billing) {
  if (!billing) return R('no_data');
  if (billing.account_budgets_error || billing.billing_setups_error) return R('billing_api_error');
  return R('billing_ui_needed');
}

function nextStepText(report) {
  if (report.guard.hard_stop) return R('next_stop');
  const protect = report.decisions.filter((d) => d.recommended_mode === 'protect_budget').map((d) => ruCategory(d.category));
  const push = report.decisions.filter((d) => d.recommended_mode === 'push' || d.recommended_mode === 'push_mobile_today').map((d) => ruCategory(d.category));
  if (push.length && protect.length) return `${R('boost')} ${push.join(', ')}, ${R('no_budget_to')} ${protect.join(', ')}.`;
  if (push.length) return `${R('careful_boost')} ${push.join(', ')} ${R('within_limit')}.`;
  return R('hold_budget');
}

function meaningText(report) {
  if (report.guard.hard_stop) return R('meaning_stop');
  const push = report.decisions.filter((d) => d.recommended_mode === 'push' || d.recommended_mode === 'push_mobile_today').map((d) => ruCategory(d.category));
  const protect = report.decisions.filter((d) => d.recommended_mode === 'protect_budget').map((d) => ruCategory(d.category));
  if (push.length && protect.length) return R('meaning_push_protect', { push: push.join(', '), protect: protect.join(', ') });
  if (push.length) return R('meaning_push', { push: push.join(', ') });
  return R('meaning_hold');
}

function shouldSendTelegram(report) {
  if (CONFIG.forceTelegram) return true;
  if (!CONFIG.telegram.botToken || !CONFIG.telegram.chatId) return false;
  const hour = new Date(report.generated_at).getUTCHours();
  return hour % CONFIG.reportEveryHours === 0;
}

function R(key, vars = {}) {
  const dict = {
    title: '\u{1F4CA} Crocus Ads: \u043f\u043e\u043d\u044f\u0442\u043d\u044b\u0439 \u043e\u0442\u0447\u0435\u0442',
    title_ops: '\u{1F4CA} Crocus Ads: \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0439 \u0447\u0435\u043a',
    title_deep: '\u{1F9E0} Crocus Ads: \u0433\u043b\u0443\u0431\u043e\u043a\u0438\u0439 \u0440\u0430\u0437\u0431\u043e\u0440',
    health_ok: '\u{1F7E2} \u0421\u0442\u0430\u0442\u0443\u0441: \u0432\u0441\u0435 \u0440\u043e\u0432\u043d\u043e, \u0441\u0442\u043e\u043f\u044b \u043d\u0435 \u0441\u0440\u0430\u0431\u043e\u0442\u0430\u043b\u0438.',
    health_warn: '\u{1F7E1} \u0421\u0442\u0430\u0442\u0443\u0441: \u0435\u0441\u0442\u044c \u043f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f, \u0441\u043a\u0440\u0438\u043f\u0442 \u043e\u0441\u0442\u043e\u0440\u043e\u0436\u043d\u0438\u0447\u0430\u0435\u0442.',
    health_stop: '\u{1F534} \u0421\u0442\u0430\u0442\u0443\u0441: \u0436\u0435\u0441\u0442\u043a\u0438\u0439 \u0441\u0442\u043e\u043f, \u0440\u0435\u043a\u043b\u0430\u043c\u0443 \u043d\u0435 \u0442\u0440\u043e\u0433\u0430\u0435\u043c.',
    block_now: '\u{1F4CD} \u0427\u0442\u043e \u0441\u0435\u0439\u0447\u0430\u0441',
    block_masters: '\u{1F465} \u041c\u0430\u0441\u0442\u0435\u0440\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f',
    block_slots: '\u{1F4C5} \u0421\u043b\u043e\u0442\u044b \u0438 \u043a\u0443\u0434\u0430 \u043b\u0438\u0442\u044c',
    block_meaning: '\u{1F9E0} \u0427\u0442\u043e \u044d\u0442\u043e \u0437\u043d\u0430\u0447\u0438\u0442',
    block_decision: '\u{1F9ED} \u0420\u0435\u0448\u0435\u043d\u0438\u0435',
    block_actions: '\u{1F6E0} \u0427\u0442\u043e \u0441\u0434\u0435\u043b\u0430\u043b \u0441\u043a\u0440\u0438\u043f\u0442',
    block_campaigns: '\u{1F3AF} \u041a\u0430\u043c\u043f\u0430\u043d\u0438\u0438 \u0437\u0430 7 \u0434\u043d\u0435\u0439',
    block_terms: '\u{1F50E} \u041f\u043e\u0438\u0441\u043a\u043e\u0432\u044b\u0435 \u0444\u0440\u0430\u0437\u044b',
    block_hours: '\u{23F0} \u0427\u0430\u0441\u044b \u0438 \u0440\u0438\u0442\u043c',
    block_ai: '\u{1F9E0} \u041c\u043e\u0437\u0433\u0438 OpenAI',
    block_account: '\u{1F9FE} \u0421\u0447\u0435\u0442 \u0438 \u043e\u043f\u043b\u0430\u0442\u0430',
    block_money: '\u{1F4B6} \u0414\u0435\u043d\u044c\u0433\u0438',
    block_next: '\u{1F680} \u0414\u0430\u043b\u044c\u0448\u0435',
    today_line: '\u0421\u0435\u0433\u043e\u0434\u043d\u044f: {impressions} \u043f\u043e\u043a\u0430\u0437\u043e\u0432, {clicks} \u043a\u043b\u0438\u043a\u043e\u0432, {cost} EUR, {conv} \u043a\u043e\u043d\u0432. Ads, CPL {cpl}.',
    yesterday_line: '\u0412\u0447\u0435\u0440\u0430: {clicks} \u043a\u043b\u0438\u043a\u043e\u0432, {cost} EUR, {conv} \u043a\u043e\u043d\u0432. Ads, CPL {cpl}.',
    period_line: '{label}: {cost} EUR, {conv} \u043a\u043e\u043d\u0432. Ads, CPL {cpl}.',
    did_apply: '\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u043b: {budgets} \u043f\u0440\u0430\u0432\u043e\u043a \u0431\u044e\u0434\u0436\u0435\u0442\u0430, {bids} \u043f\u0440\u0430\u0432\u043e\u043a \u0441\u0442\u0430\u0432\u043e\u043a.',
    did_dryrun: '\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043c\u0435\u043d\u044f\u043b: \u044d\u0442\u043e dry-run. \u041f\u043b\u0430\u043d \u0433\u043e\u0442\u043e\u0432: {budgets} \u0431\u044e\u0434\u0436\u0435\u0442\u0430, {bids} \u0441\u0442\u0430\u0432\u043e\u043a.',
    why: '\u041f\u043e\u0447\u0435\u043c\u0443',
    bids: '\u0421\u0442\u0430\u0432\u043a\u0438',
    risk: '\u0440\u0438\u0441\u043a',
    winner: '\u043f\u043e\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u044c',
    best_hours: '\u043b\u0443\u0447\u0448\u0438\u0435 \u0447\u0430\u0441\u044b',
    waste_hours: '\u043e\u043f\u0430\u0441\u043d\u044b\u0435 \u0447\u0430\u0441\u044b',
    no_live_changes_needed: '\u0416\u0438\u0432\u044b\u0435 \u043f\u0440\u0430\u0432\u043a\u0438 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435 \u043d\u0443\u0436\u043d\u044b: \u043d\u0435\u0442 \u0441\u0438\u043b\u044c\u043d\u043e\u0433\u043e \u0441\u0438\u0433\u043d\u0430\u043b\u0430 \u0438\u043b\u0438 \u0441\u0442\u043e\u043f\u044b \u0434\u0435\u0440\u0436\u0430\u0442 \u0440\u0443\u043b\u044c.',
    full: '\u0444\u0443\u043b\u043b',
    few_windows: '\u0435\u0441\u0442\u044c \u043f\u0430\u0440\u0430 \u043e\u043a\u043e\u043d',
    has_windows: '\u0435\u0441\u0442\u044c \u043e\u043a\u043d\u0430',
    discipline_apply: '\u041f\u0440\u0430\u0432\u043a\u0438 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u044b allowlist, \u043b\u0438\u043c\u0438\u0442\u043e\u043c 30 EUR/day \u0438 \u043c\u0430\u043b\u044b\u043c \u0448\u0430\u0433\u043e\u043c: \u0440\u0435\u0437\u043a\u043e \u043e\u0431\u0443\u0447\u0435\u043d\u0438\u0435 \u043d\u0435 \u043b\u043e\u043c\u0430\u0435\u043c.',
    discipline_dry: '\u042d\u0442\u043e \u0438\u043d\u0444\u043e-\u0440\u0435\u0436\u0438\u043c: Google Ads \u043d\u0435 \u0442\u0440\u043e\u043d\u0443\u0442, \u0441\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043c\u043e\u0442\u0440\u0438\u043c \u0444\u0430\u043a\u0442\u044b.',
    plan_line: '\u041f\u043b\u0430\u043d',
    limit_line: '\u041b\u0438\u043c\u0438\u0442 \u0432 \u0441\u0443\u0442\u043a\u0438: {limit} EUR.',
    meaning_stop: '\u0415\u0441\u0442\u044c \u0441\u0442\u043e\u043f-\u0443\u0441\u043b\u043e\u0432\u0438\u0435. \u041b\u0443\u0447\u0448\u0435 \u0441\u043d\u0430\u0447\u0430\u043b\u0430 \u0440\u0430\u0437\u043e\u0431\u0440\u0430\u0442\u044c \u043f\u0440\u0438\u0447\u0438\u043d\u0443, \u0447\u0435\u043c \u0434\u0432\u0438\u0433\u0430\u0442\u044c \u0434\u0435\u043d\u044c\u0433\u0438.',
    meaning_push_protect: '\u0415\u0441\u0442\u044c \u043a\u0443\u0434\u0430 \u0437\u0430\u043f\u0438\u0441\u044b\u0432\u0430\u0442\u044c: {push}. \u0412 {protect} \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435 \u043b\u044c\u0435\u043c, \u0442\u0430\u043c \u043d\u0435\u0442 \u0435\u043c\u043a\u043e\u0441\u0442\u0438.',
    meaning_push: '\u0415\u0441\u0442\u044c \u0435\u043c\u043a\u043e\u0441\u0442\u044c \u043f\u043e {push}. \u041c\u043e\u0436\u043d\u043e \u0430\u043a\u043a\u0443\u0440\u0430\u0442\u043d\u043e \u0443\u0441\u0438\u043b\u0438\u0432\u0430\u0442\u044c \u0432 \u0440\u0430\u043c\u043a\u0430\u0445 \u043b\u0438\u043c\u0438\u0442\u0430.',
    meaning_hold: '\u0421\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0442 \u044f\u0432\u043d\u043e\u0433\u043e \u0441\u0438\u0433\u043d\u0430\u043b\u0430 \u0434\u043b\u044f \u0443\u0441\u0438\u043b\u0435\u043d\u0438\u044f. \u0414\u0435\u0440\u0436\u0438\u043c \u0431\u044e\u0434\u0436\u0435\u0442.',
    short_report: '\u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0439 \u043e\u0442\u0447\u0435\u0442',
    now: '\u0421\u0435\u0439\u0447\u0430\u0441',
    yesterday: '\u0412\u0447\u0435\u0440\u0430',
    days: '\u0434\u043d\u0435\u0439',
    month: '\u041c\u0435\u0441\u044f\u0446',
    impressions: '\u043f\u043e\u043a\u0430\u0437\u043e\u0432',
    clicks: '\u043a\u043b\u0438\u043a\u043e\u0432',
    conversions_short: '\u043a\u043e\u043d\u0432. Ads',
    slots: '\u0421\u043b\u043e\u0442\u044b',
    today_lc: '\u0441\u0435\u0433\u043e\u0434\u043d\u044f',
    next7: '\u043d\u0430 7 \u0434\u043d\u0435\u0439',
    hour_windows_today: '\u0447\u0430\u0441\u043e\u0432\u044b\u0445 \u043e\u043a\u043e\u043d \u0441\u0435\u0433\u043e\u0434\u043d\u044f',
    hour_windows_next7: '\u0447\u0430\u0441\u043e\u0432\u044b\u0445 \u043e\u043a\u043e\u043d \u043d\u0430 7 \u0434\u043d\u0435\u0439',
    decision: '\u0420\u0435\u0448\u0435\u043d\u0438\u0435',
    protection: '\u0417\u0430\u0449\u0438\u0442\u0430',
    billing: '\u041e\u043f\u043b\u0430\u0442\u0430',
    next: '\u0414\u0430\u043b\u044c\u0448\u0435',
    changes_on: `\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u044b: ${vars.budgets} \u0431\u044e\u0434\u0436\u0435\u0442\u043e\u0432, ${vars.bids} \u0441\u0442\u0430\u0432\u043e\u043a.`,
    dry_run_plan: `\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043c\u0435\u043d\u044f\u043b: dry-run. \u041f\u043b\u0430\u043d: ${vars.budgets} \u0431\u044e\u0434\u0436\u0435\u0442\u043e\u0432, ${vars.bids} \u0441\u0442\u0430\u0432\u043e\u043a.`,
    ok: '\u043e\u043a',
    stop: '\u0421\u0422\u041e\u041f',
    warnings: '\u0435\u0441\u0442\u044c \u043f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f',
    no_warnings: '\u043f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u0439 \u043d\u0435\u0442',
    manicure: '\u041c\u0430\u043d\u0438\u043a\u044e\u0440',
    pedicure: '\u041f\u0435\u0434\u0438\u043a\u044e\u0440',
    lashes: '\u0420\u0435\u0441\u043d\u0438\u0446\u044b',
    push: '\u043f\u0443\u0448\u0438\u043c',
    push_mobile_today: '\u043f\u0443\u0448\u0438\u043c \u043c\u043e\u0431\u0438\u043b\u043a\u0443 \u0441\u0435\u0433\u043e\u0434\u043d\u044f',
    hold: '\u0434\u0435\u0440\u0436\u0438\u043c',
    protect_budget: '\u0431\u0435\u0440\u0435\u0436\u0435\u043c \u0431\u044e\u0434\u0436\u0435\u0442',
    reason_enough_slots: '\u0435\u0441\u0442\u044c \u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0441\u043b\u043e\u0442\u043e\u0432',
    reason_urgency: '\u0441\u043b\u043e\u0442\u043e\u0432 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u043c\u0430\u043b\u043e, \u0441\u0440\u043e\u0447\u043d\u043e\u0441\u0442\u044c \u043c\u043e\u0436\u0435\u0442 \u0441\u0440\u0430\u0431\u043e\u0442\u0430\u0442\u044c',
    reason_low_slots: '\u043c\u0430\u043b\u043e \u0438\u043b\u0438 \u043d\u0435\u0442 \u0441\u043b\u043e\u0442\u043e\u0432',
    reason_normal: '\u043e\u0431\u044b\u0447\u043d\u0430\u044f \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0430',
    plan_by_slots: '\u0440\u0435\u0448\u0435\u043d\u0438\u0435 \u043f\u043e \u0441\u043b\u043e\u0442\u0430\u043c, \u0435\u043c\u043a\u043e\u0441\u0442\u0438 \u0438 \u0442\u0435\u043a\u0443\u0449\u0438\u043c \u0434\u0430\u043d\u043d\u044b\u043c Google Ads',
    plan_broad: '\u043d\u0430\u0439\u0434\u0435\u043d broad-\u0440\u0438\u0441\u043a, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u0441\u0442\u0430\u0432\u043a\u0438 \u043d\u0435 \u0443\u0432\u0435\u043b\u0438\u0447\u0438\u0432\u0430\u0435\u043c',
    plan_stop: '\u0436\u0435\u0441\u0442\u043a\u0438\u0439 \u0441\u0442\u043e\u043f, \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d\u044b',
    dry_run_full: 'dry-run, \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u043d\u0435 \u043f\u0440\u0438\u043c\u0435\u043d\u044f\u043b\u0438\u0441\u044c',
    no_data: '\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445',
    billing_api_error: '\u043d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u0447\u0435\u0440\u0435\u0437 API',
    billing_ui_needed: '\u0442\u043e\u0447\u043d\u0430\u044f \u0441\u0443\u043c\u043c\u0430 \u043a \u043e\u043f\u043b\u0430\u0442\u0435 \u0438 \u0441\u0440\u043e\u043a \u0432 API \u043d\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b',
    next_stop: '\u043d\u0435 \u0442\u0440\u043e\u0433\u0430\u0442\u044c \u0440\u0435\u043a\u043b\u0430\u043c\u0443, \u0441\u043d\u0430\u0447\u0430\u043b\u0430 \u0440\u0430\u0437\u043e\u0431\u0440\u0430\u0442\u044c \u0441\u0442\u043e\u043f',
    boost: '\u0443\u0441\u0438\u043b\u0438\u0432\u0430\u0442\u044c',
    no_budget_to: '\u0431\u044e\u0434\u0436\u0435\u0442 \u043d\u0435 \u043b\u0438\u0442\u044c \u0432',
    careful_boost: '\u0430\u043a\u043a\u0443\u0440\u0430\u0442\u043d\u043e \u0443\u0441\u0438\u043b\u0438\u0432\u0430\u0442\u044c',
    within_limit: '\u0432 \u0440\u0430\u043c\u043a\u0430\u0445 \u043b\u0438\u043c\u0438\u0442\u0430',
    hold_budget: '\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u0431\u044e\u0434\u0436\u0435\u0442 \u0438 \u0436\u0434\u0430\u0442\u044c \u043d\u043e\u0432\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435',
  };
  const template = dict[key] || key;
  return Object.entries(vars).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
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
    summary[key] ||= { category: row.category, date: row.date, slots_count: 0, masters_with_slots: [], slot_keys: new Set() };
    for (const hour of row.slot_hours || []) {
      summary[key].slot_keys.add(`${row.master_id}:${hour}`);
    }
    summary[key].slots_count = summary[key].slot_keys.size;
    if ((row.slot_hours || []).length > 0 && !summary[key].masters_with_slots.includes(row.master_name)) {
      summary[key].masters_with_slots.push(row.master_name);
    }
  }
  return Object.values(summary)
    .map(({ slot_keys, ...item }) => item)
    .sort((a, b) => `${a.category}${a.date}`.localeCompare(`${b.category}${b.date}`));
}

function summarizeTodayMasters(rows) {
  const today = dateOnly(new Date());
  const summary = {};
  for (const row of rows.filter((item) => item.date === today)) {
    const key = `${row.master_id}:${row.category}`;
    summary[key] ||= {
      master_id: row.master_id,
      master_name: row.master_name,
      category: row.category,
      hours_set: new Set(),
    };
    for (const hour of row.slot_hours || []) summary[key].hours_set.add(hour);
  }
  return Object.values(summary)
    .map((item) => ({
      master_id: item.master_id,
      master_name: item.master_name,
      category: item.category,
      windows: item.hours_set.size,
      hours: [...item.hours_set].sort(),
    }))
    .sort((a, b) => a.master_name.localeCompare(b.master_name) || a.category.localeCompare(b.category));
}

function countSlotWindows(rows, predicate) {
  const keys = new Set();
  for (const row of rows.filter(predicate)) {
    for (const hour of row.slot_hours || []) {
      keys.add(`${row.date}:${row.master_id}:${row.category}:${hour}`);
    }
  }
  return keys.size;
}

function emptyMetrics() {
  return { impressions: 0, clicks: 0, cost_eur: 0, conversions: 0, conversions_value: 0 };
}

function normalizeMetrics(metrics) {
  return {
    impressions: Number(metrics?.impressions || 0),
    clicks: Number(metrics?.clicks || 0),
    cost_eur: Number(metrics?.costMicros || 0) / 1_000_000,
    conversions: Number(metrics?.conversions || 0),
    conversions_value: Number(metrics?.conversionsValue || 0),
  };
}

function addMetrics(target, metrics) {
  target.impressions += metrics.impressions;
  target.clicks += metrics.clicks;
  target.cost_eur += metrics.cost_eur;
  target.conversions += metrics.conversions;
  target.conversions_value += metrics.conversions_value;
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

