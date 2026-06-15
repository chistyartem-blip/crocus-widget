#!/usr/bin/env node

const token = process.env.TELEGRAM_BOT_TOKEN;
const workerUrl = process.env.TELEGRAM_WORKER_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) fail('Missing TELEGRAM_BOT_TOKEN');
if (!workerUrl) fail('Missing TELEGRAM_WORKER_URL');
if (!secret) fail('Missing TELEGRAM_WEBHOOK_SECRET');

const api = `https://api.telegram.org/bot${token}`;

const me = await telegram('getMe');
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
