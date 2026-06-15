/**
 * Telegram Ads Bot for Crocus.
 * Receives natural-language Russian commands and dispatches GitHub Actions.
 */

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return json({ ok: true, message: 'telegram bot webhook is alive' });

    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return json({ ok: false, error: 'bad webhook secret' }, 403);
    }

    let update;
    try { update = await request.json(); }
    catch (_) { return json({ ok: false, error: 'bad json' }, 400); }

    const message = update.message || update.edited_message;
    const chatId = String(message?.chat?.id || '');
    const text = String(message?.text || '').trim();
    if (!chatId || !text) return json({ ok: true, skipped: 'no message text' });

    if (String(env.TELEGRAM_CHAT_ID) !== chatId) {
      await sendTelegram(env, chatId, 'Access denied.');
      return json({ ok: false, error: 'unauthorized chat' }, 403);
    }

    const normalized = text.toLowerCase();

    if (hasAny(normalized, ['/help', '/start', R('help_word'), R('commands_word'), R('start_word')])) {
      await sendTelegram(env, chatId, `${R('bot_connected')}\n\n${commandsText()}`);
      return json({ ok: true });
    }

    if (hasAny(normalized, ['/status', 'status', R('status_word'), R('runs_word')])) {
      const url = `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW_ID}`;
      await sendTelegram(env, chatId, `${R('runs')}\n${url}`);
      return json({ ok: true });
    }

    if (hasAny(normalized, ['/apply', 'apply', R('apply_word'), R('change_word'), R('use_word')])) {
      await dispatchGovernor(env, true);
      await sendTelegram(env, chatId, R('apply_started'));
      return json({ ok: true, dispatched: 'apply' });
    }

    if (hasAny(normalized, ['/dryrun', 'dry', 'test', R('check_word'), R('slots_word'), R('report_word'), R('what_now_word')])) {
      await dispatchGovernor(env, false);
      await sendTelegram(env, chatId, R('dryrun_started'));
      return json({ ok: true, dispatched: 'dryrun' });
    }

    await sendTelegram(env, chatId, `${R('unknown')}\n\n${commandsText()}`);
    return json({ ok: true, skipped: 'unknown command' });
  },
};

function hasAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function commandsText() {
  return [
    `${R('cmd_help')}`,
    `${R('cmd_dryrun')}`,
    `${R('cmd_apply')}`,
    `${R('cmd_status')}`,
    '',
    `${R('natural_examples')}`,
  ].join('\n');
}

async function dispatchGovernor(env, apply) {
  const owner = env.GITHUB_OWNER || 'chistyartem-blip';
  const repo = env.GITHUB_REPO || 'crocus-widget';
  const workflow = env.GITHUB_WORKFLOW_ID || 'ads-budget-governor.yml';
  const ref = env.GITHUB_REF || 'main';
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'crocus-telegram-ads-bot',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref, inputs: { apply: apply ? 'true' : 'false' } }),
  });
  if (!res.ok) throw new Error(`GitHub dispatch failed: ${res.status} ${await res.text()}`);
}

async function sendTelegram(env, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram send failed: ${res.status}`);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function R(key) {
  const dict = {
    bot_connected: '\u0411\u043e\u0442 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d. \u041c\u043e\u0436\u043d\u043e \u043f\u0438\u0441\u0430\u0442\u044c \u043e\u0431\u044b\u0447\u043d\u044b\u043c\u0438 \u0444\u0440\u0430\u0437\u0430\u043c\u0438.',
    runs: '\u0417\u0430\u043f\u0443\u0441\u043a\u0438 Ads Governor:',
    apply_started: '\u0417\u0430\u043f\u0443\u0441\u043a \u0441 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u0435\u043c \u0441\u0442\u0430\u0440\u0442\u043e\u0432\u0430\u043b. \u0417\u0430\u0449\u0438\u0442\u0430 \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u0430: \u043b\u0438\u043c\u0438\u0442, allowlist, \u0441\u0442\u043e\u043f\u044b. \u041e\u0442\u0447\u0435\u0442 \u043f\u0440\u0438\u0434\u0435\u0442 \u043f\u043e\u0441\u043b\u0435 \u043f\u0440\u043e\u0433\u043e\u043d\u0430.',
    dryrun_started: '\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0441\u0442\u0430\u0440\u0442\u043e\u0432\u0430\u043b\u0430. Google Ads \u043d\u0435 \u0442\u0440\u043e\u0433\u0430\u044e. \u041e\u0442\u0447\u0435\u0442 \u043f\u0440\u0438\u0434\u0435\u0442 \u043f\u043e\u0441\u043b\u0435 GitHub Actions.',
    unknown: '\u041d\u0435 \u043f\u043e\u043d\u044f\u043b \u0437\u0430\u043f\u0440\u043e\u0441.',
    cmd_help: '\u041f\u043e\u043c\u043e\u0449\u044c / help - \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043a\u043e\u043c\u0430\u043d\u0434\u044b',
    cmd_dryrun: '\u041f\u0440\u043e\u0432\u0435\u0440\u044c / \u0427\u0442\u043e \u0441\u0435\u0439\u0447\u0430\u0441 / \u0427\u0442\u043e \u0441\u043e \u0441\u043b\u043e\u0442\u0430\u043c\u0438 - \u043e\u0442\u0447\u0435\u0442 \u0431\u0435\u0437 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439',
    cmd_apply: '\u041f\u0440\u0438\u043c\u0435\u043d\u0438 / apply - \u0432\u043d\u0435\u0441\u0442\u0438 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0435 \u043f\u0440\u0430\u0432\u043a\u0438',
    cmd_status: '\u0421\u0442\u0430\u0442\u0443\u0441 - \u0441\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 GitHub Actions',
    natural_examples: '\u041f\u0440\u0438\u043c\u0435\u0440\u044b: "\u0447\u0442\u043e \u0441\u0435\u0439\u0447\u0430\u0441", "\u043f\u0440\u043e\u0432\u0435\u0440\u044c \u0441\u043b\u043e\u0442\u044b", "\u043c\u043e\u0436\u043d\u043e \u043b\u0438 \u043f\u0443\u0448\u0438\u0442\u044c", "\u043f\u0440\u0438\u043c\u0435\u043d\u0438".',
    help_word: '\u043f\u043e\u043c\u043e\u0449',
    commands_word: '\u043a\u043e\u043c\u0430\u043d\u0434',
    start_word: '\u0441\u0442\u0430\u0440\u0442',
    status_word: '\u0441\u0442\u0430\u0442\u0443\u0441',
    runs_word: '\u0437\u0430\u043f\u0443\u0441\u043a',
    apply_word: '\u043f\u0440\u0438\u043c\u0435\u043d',
    change_word: '\u0438\u0437\u043c\u0435\u043d',
    use_word: '\u0432\u043d\u0435\u0441',
    check_word: '\u043f\u0440\u043e\u0432\u0435\u0440',
    slots_word: '\u0441\u043b\u043e\u0442',
    report_word: '\u043e\u0442\u0447\u0435\u0442',
    what_now_word: '\u0447\u0442\u043e \u0441\u0435\u0439\u0447\u0430\u0441',
  };
  return dict[key] || key;
}
