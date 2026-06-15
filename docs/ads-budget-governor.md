# Ads Budget Governor

`scripts/ads-budget-governor.mjs` checks live Altegio slots and Google Ads state, then plans safe daily budget/bid changes for the three active Crocus campaigns.

## Safety Rules

- Hard daily cap via `ADS_GOVERNOR_MAX_DAILY_BUDGET_EUR` (default `30`).
- Allowlist only:
  - `[PMax] Crocus Beauty Studio - Goeppingen`
  - `[Slim] Manikuere - Goeppingen`
  - `[Slim] Pedikuere - Goeppingen`
- Never enables paused campaigns, ad groups, keywords, or broad keywords.
- If broad keywords are enabled, it refuses Search bid increases.
- If required Google Ads env vars are missing, it exits before changing anything.
- Dry-run by default; real mutations only when `ADS_GOVERNOR_APPLY=true`.
- Every run writes a JSON report to `reports/`.
- Every run also writes a Markdown report and can send a Telegram summary.

## Local Dry-Run

```bash
ADS_GOVERNOR_APPLY=false node scripts/ads-budget-governor.mjs
```

## Required GitHub Secrets

- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CUSTOMER_ID`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID`

Optional Telegram Secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## Telegram Bot Commands

The scheduled governor sends Telegram reports when `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are configured in GitHub Secrets.

For interactive commands, deploy `telegram-ads-bot-worker.js` as a Cloudflare Worker and set the Telegram webhook to that Worker URL.

Worker secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `GITHUB_TOKEN`
- `OPENAI_API_KEY` optional, for free-form chat
- `OPENAI_PROJECT_ID` optional, when using a specific OpenAI project

Worker vars:

- `GITHUB_OWNER=chistyartem-blip`
- `GITHUB_REPO=crocus-widget`
- `GITHUB_WORKFLOW_ID=ads-budget-governor.yml`
- `GITHUB_REF=main`
- `OPENAI_MODEL=gpt-4o-mini` optional

Commands:

- `/help`
- `/status`
- `/dryrun`
- `/apply`

`/dryrun` and `/apply` trigger the GitHub Actions workflow. The governor then sends the report back to Telegram after it finishes.

If `OPENAI_API_KEY` is configured, non-command messages become a Russian marketing chat assistant for this Crocus Ads context. It must not invent live stats; for current numbers it asks the user to run a fresh check.

Webhook setup:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://YOUR_WORKER.YOUR_SUBDOMAIN.workers.dev" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Or use the safe helper script:

```bash
TELEGRAM_BOT_TOKEN=... \
TELEGRAM_WORKER_URL=https://YOUR_WORKER.YOUR_SUBDOMAIN.workers.dev \
TELEGRAM_WEBHOOK_SECRET=... \
node scripts/setup-telegram-webhook.mjs
```

The helper prints the bot username and webhook status, but never prints the token.

Get your Telegram chat id after sending `/start` to the bot:

```bash
TELEGRAM_BOT_TOKEN=... node scripts/setup-telegram-webhook.mjs chat-id
```

Send a test message:

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node scripts/setup-telegram-webhook.mjs test-message
```

## Recommended GitHub Variables

- `ADS_GOVERNOR_APPLY=true`
- `ADS_GOVERNOR_MAX_DAILY_BUDGET_EUR=30`
- `ADS_GOVERNOR_LOOKAHEAD_DAYS=14`
- `ALTEGIO_PROXY_BASE=https://crocus-proxy.crocusbeautystudio.workers.dev/api/proxy`
- `ALTEGIO_LOCATION_ID=1357963`

## Daily Logic

At each run, the script:

1. Reads Altegio slots for the next 14 days.
2. Classifies each service category as `push`, `push_mobile_today`, `hold`, or `protect_budget`.
3. Reads live Google Ads campaign and keyword state.
4. Applies hard guards.
5. Plans budgets under the daily cap.
6. Plans cautious Search CPC changes with a max `0.15 EUR` per-keyword delta per run.
7. Applies changes only when `ADS_GOVERNOR_APPLY=true`.
8. Writes JSON + Markdown reports and sends Telegram if configured.

## Report Contents

The report explains:

- yesterday vs today performance: impressions, clicks, spend, conversions, CPL
- live slot counts today and next 7 days
- decision per category: `push`, `push_mobile_today`, `hold`, `protect_budget`
- budget changes planned/applied
- keyword bid changes planned/applied
- guard warnings and hard stops
