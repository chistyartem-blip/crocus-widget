#!/usr/bin/env node

const token = process.env.TELEGRAM_BOT_TOKEN;
const workerUrl = process.env.TELEGRAM_WORKER_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const mode = process.argv[2] || 'set-webhook';

if (!token) fail('Missing TELEGRAM_BOT_TOKEN');

const api = `https://api.telegram.org/bot${token}`;

const me = await telegram('getMe');

if (mode === 'chat-id') {
  const updates = await telegram('getUpdates');
  const chats = [];
  for (const update of updates.result || []) {
    const chat = update.message?.chat || update.edited_message?.chat;
    if (!chat?.id) continue;
    const item = {
      id: String(chat.id),
      type: chat.type,
      username: chat.username || '',
      first_name: chat.first_name || '',
      title: chat.title || '',
    };
    if (!chats.some((known) => known.id === item.id)) chats.push(item);
  }
  console.log(JSON.stringify({
    ok: true,
    bot_username: me.result?.username,
    chats,
    hint: chats.length ? 'Use the id as TELEGRAM_CHAT_ID.' : 'Send /start to the bot first, then run again.',
  }, null, 2));
} else if (mode === 'test-message') {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) fail('Missing TELEGRAM_CHAT_ID');
  await telegram('sendMessage', {
    chat_id: chatId,
    text: 'Crocus Ads Bot connected. Reports can be sent here.',
    disable_web_page_preview: true,
  });
  console.log(JSON.stringify({ ok: true, bot_username: me.result?.username, test_message_sent: true }, null, 2));
} else {
  if (!workerUrl) fail('Missing TELEGRAM_WORKER_URL');
  if (!secret) fail('Missing TELEGRAM_WEBHOOK_SECRET');
  const webhook = await telegram('setWebhook', {
    url: workerUrl,
    secret_token: secret,
    drop_pending_updates: false,
  });
  console.log(JSON.stringify({
    ok: true,
    bot_username: me.result?.username,
    webhook_set: webhook.ok === true,
    worker_url: workerUrl,
  }, null, 2));
}

async function telegram(method, body) {
  const res = await fetch(`${api}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    fail(`${method} failed: ${data.description || res.status}`);
  }
  return data;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
