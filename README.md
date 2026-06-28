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
| `CRON_SCHEDULE` | No | Default: `*/1 * * * *` (every minute) |
| `CRON_ENABLED` | No | Default: `true` |
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
| POST | `/api/watch-items` | Add: `{ "keywords": "...", "catalogUrl": "https://..." }` |
| PUT | `/api/watch-items/:id` | Update keywords, `catalogUrl`, or `is_active` |
| DELETE | `/api/watch-items/:id` | Remove watch item |
| POST | `/api/test-scrape` | Test scrape: `{ "catalogUrl": "https://..." }` |
| POST | `/api/run-check` | Run check manually (runs even when monitoring is paused) |
| GET | `/api/monitoring/status` | Monitoring status: paused, cron, active items, last check |
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

## Supplier URLs

Each watch item has its own `catalogUrl` (collection page to scrape).
The dashboard (Base44) sends the URL when adding or editing a watch item.

Brand Off Shopify sites use the `brandoff` scraper automatically when the hostname is `brandoffbuyingclub.com`.
Other URLs fall back to generic HTML scraping.

Example:
`https://brandoffbuyingclub.com/collections/chanel-bags-collection`
