# daniz-sniff-items - the buyer scanner ("הקניין")

A small server on Fly.io (app `daniz-sniff-items`, region fra, 256MB) that works for Danni:

- Every 10 minutes reads the new items of the suppliers (Shopify `products.json`): Club, PURPOSE, DCT.
  A normal run reads the first 3 pages of each store; every 2 hours a deep run reads up to 40 pages.
- Sends every new item to the CRM (Base44 function `buyerAgent`, action `ingest`). The CRM saves it on the Buyer page
  ("קניין"), scores it and answers with the score / expected profit / names it matched.
- Telegram to Danni:
  - 🔔 an item whose title has all the words of one of her names (the names are managed on the CRM Buyer page)
  - 📦 every 20 new items of a store: how many are good (score 80+) and how many are models she never sold
  - ☀️ 9:00 summary of yesterday: items per store, good ones, the 5 best
- SQLite on the volume (`/app/data/sniff.db`): seen products, new items with their scores, the 20-items counters.

## Deploy

Push to `master` -> GitHub Actions deploys (`.github/workflows/fly-deploy.yml`, secret `FLY_API_TOKEN`).

## Secrets on Fly

| Name | |
|---|---|
| `API_KEY` | Also the key for the CRM (must equal `SNIFF_API_KEY` in the CRM). Unless `CRM_API_KEY` is set |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Telegram |

Optional: `SCAN_CRON` (default `*/10 * * * *`), `BATCH_ALERT_SIZE` (20), `GOOD_SCORE` (80), `DAILY_DIGEST_CRON` (`0 9 * * *`),
`DAILY_DIGEST_TOP` (5), `QUICK_PAGES` (3), `DEEP_PAGES` (40), `DEEP_EVERY_HOURS` (2), `FIRST_RUN_DAYS` (3), `CRM_FUNCTION_URL`, `CRM_BUYER_URL`.

## API (header `Authorization: Bearer <API_KEY>`)

| | |
|---|---|
| `GET /health` | no key |
| `GET /api/probe` | can the server read each supplier |
| `POST /api/run-check` | scan now (`{"deep": true}` for all pages) |
| `GET /api/monitoring/status`, `POST /api/monitoring/pause`, `/resume` | |
| `GET /api/digest-preview`, `POST /api/digest-send` | the morning message |

## Cost

Fly bills the machine, not the requests: shared-cpu-1x 256MB (~2.2 dollars) + 1GB volume (0.15). Inbound traffic is free.
Keep the machine at 256MB so the monthly bill stays under the 5 dollars Fly does not collect.
