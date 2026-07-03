# daniz-sniff-items

Monitor a supplier website for luxury bags and send Telegram alerts when matching products appear.

## Setup

1. Copy `.env.example` to `.env` and fill in values
2. `npm install`
3. `npm run dev` (development) or `npm run build && npm start` (production)

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | Yes | Secret for dashboard API calls |
| `TELEGRAM_BOT_TOKEN` | For alerts | From @BotFather |
| `TELEGRAM_CHAT_ID` | For alerts | Your chat or group ID |
| `DATABASE_PATH` | No | Default: `./data/sniff.db` |
| `CRON_SCHEDULE` | No | Default: `*/3 * * * *` (every 3 minutes) |
| `CRON_ENABLED` | No | Default: `true` |
| `CATALOG_URLS` | No | Comma-separated collection URLs to scrape (defaults to Hong Kong + New In) |
| `SCRAPE_MAX_PAGES` | No | Default: `2` — pages scraped per site |
| `SCRAPE_PAGE_DELAY_MS` | No | Default: `4000` — delay between page/site fetches |
| `NEW_ITEMS_THRESHOLD` | No | Default: `10` — new items per site before a heads-up alert |
| `DAILY_DIGEST_ENABLED` | No | Default: `true` — morning Telegram status |
| `DAILY_DIGEST_CRON` | No | Default: `0 9 * * *` (9:00 daily) |
| `DAILY_DIGEST_TIMEZONE` | No | Default: `Asia/Jerusalem` |
| `DAILY_DIGEST_RECIPIENT_NAME` | No | Default: `Dani` — name in daily message |

## API

All endpoints except `/health` require:

```
Authorization: Bearer <API_KEY>
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/watch-items` | List watch items |
| POST | `/api/watch-items` | Add: `{ "keywords": "..." }` (matched against all sites; `catalogUrl` optional) |
| PUT | `/api/watch-items/:id` | Update keywords or `is_active` |
| DELETE | `/api/watch-items/:id` | Remove watch item |
| POST | `/api/test-scrape` | Test scrape: `{ "catalogUrl": "https://..." }` |
| POST | `/api/run-check` | Run check manually (runs even when monitoring is paused) |
| GET | `/api/monitoring/status` | Status: paused, cron, monitored sites, last check |
| POST | `/api/monitoring/pause` | Pause automatic cron checks |
| POST | `/api/monitoring/resume` | Resume automatic cron checks |
| GET | `/api/found-products` | Last matched products (default 10; `?limit=10`) |

## Deploy to Fly.io

```bash
fly auth login
fly launch          # if not already created
fly volumes create sniff_data --size 1 --region fra
fly secrets set API_KEY=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...
fly deploy
```

## Monitored sites

The sites to scrape are configured centrally via `CATALOG_URLS` (comma-separated).
Every active keyword is matched against **all** monitored sites. Defaults:

- `https://brandoffbuyingclub.com/collections/international-stock-from-hong-kong`
- `https://brandoffbuyingclub.com/collections/new-in`

Each site is scraped over `SCRAPE_MAX_PAGES` pages (default 2), with a
`SCRAPE_PAGE_DELAY_MS` delay between fetches to reduce blocking risk.

Brand Off Shopify sites use the `brandoff` scraper (embedded `ShopifyAnalytics.meta`
with DOM fallback); other hostnames fall back to generic HTML scraping.

## New items notifier

Every product on each site is tracked in `catalog_products`. When a site accumulates
`NEW_ITEMS_THRESHOLD` (default 10) newly-listed products, a short Telegram heads-up is
sent so Dani can browse for relevant buys. The first run per site seeds silently.
