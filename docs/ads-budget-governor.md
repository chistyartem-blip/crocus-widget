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
