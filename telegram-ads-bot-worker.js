/**
 * Telegram Ads Bot for Crocus.
 *
 * Purpose:
 * - Receive Telegram commands.
 * - Verify the sender chat id.
 * - Trigger the GitHub Actions Ads Budget Governor workflow.
 *
 * Secrets required in Cloudflare Worker:
 * - TELEGRAM_BOT_TOKEN
 * - TELEGRAM_CHAT_ID
 * - GITHUB_TOKEN
 *
 * Vars required in Cloudflare Worker:
 * - GITHUB_OWNER=chistyartem-blip
 * - GITHUB_REPO=crocus-widget
 * - GITHUB_WORKFLOW_ID=ads-budget-governor.yml
 * - GITHUB_REF=main
 */

const COMMANDS = [
  '/help - команды',
  '/dryrun - проверить и посчитать план без изменений в Google Ads',
  '/apply - применить безопасные изменения',
  '/status - ссылка на запуски GitHub Actions',
];

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return json({ ok: true, message: 'telegram bot webhook is alive' });

    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return json({ ok: false, error: 'bad webhook secret' }, 403);
    }

    let update;
    try {
      update = await request.json();
    } catch (_) {
      return json({ ok: false, error: 'bad json' }, 400);
    }

    const message = update.message || update.edited_message;
    const chatId = String(message?.chat?.id || '');
    const text = String(message?.text || '').trim();
    if (!chatId || !text) return json({ ok: true, skipped: 'no message text' });

    if (String(env.TELEGRAM_CHAT_ID) !== chatId) {
      await sendTelegram(env, chatId, 'Access denied.');
      return json({ ok: false, error: 'unauthorized chat' }, 403);
    }

    if (text.startsWith('/help') || text.startsWith('/start')) {
      await sendTelegram(env, chatId, `Crocus Ads Bot подключен.\n\n${COMMANDS.join('\n')}`);
      return json({ ok: true });
    }

    if (text.startsWith('/status')) {
      const url = `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW_ID}`;
      await sendTelegram(env, chatId, `Запуски Ads Governor:\n${url}`);
      return json({ ok: true });
    }

    if (text.startsWith('/dryrun')) {
      await dispatchGovernor(env, false);
      await sendTelegram(env, chatId, 'Dry-run запущен. Ничего в Google Ads не меняю. Отчет придет после завершения GitHub Actions.');
      return json({ ok: true, dispatched: 'dryrun' });
    }

    if (text.startsWith('/apply')) {
      await dispatchGovernor(env, true);
      await sendTelegram(env, chatId, 'Apply-запуск стартовал. Защита включена: лимит бюджета, allowlist кампаний, стопы по broad и ошибкам. Отчет придет после завершения.');
      return json({ ok: true, dispatched: 'apply' });
    }

    await sendTelegram(env, chatId, `Не понял команду.\n\n${COMMANDS.join('\n')}`);
    return json({ ok: true, skipped: 'unknown command' });
  },
};

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
    body: JSON.stringify({
      ref,
      inputs: { apply: apply ? 'true' : 'false' },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub dispatch failed: ${res.status} ${body}`);
  }
}

async function sendTelegram(env, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) throw new Error(`Telegram send failed: ${res.status}`);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
