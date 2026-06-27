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

## API

All endpoints except `/health` require:

```
Authorization: Bearer <API_KEY>
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/watch-items` | List watch items |
| POST | `/api/watch-items` | Add: `{ "keywords": "Chanel Classic Flap" }` |
| PUT | `/api/watch-items/:id` | Update keywords or `is_active` |
| DELETE | `/api/watch-items/:id` | Remove watch item |
| POST | `/api/test-scrape` | Test supplier scrape (returns up to 20 products) |
| POST | `/api/run-check` | Run check manually |

## Deploy to Fly.io

```bash
fly auth login
fly launch          # if not already created
fly volumes create sniff_data --size 1 --region fra
fly secrets set API_KEY=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...
fly deploy
```

## Supplier (Brand Off)

The catalog URL is hardcoded in `src/scrapers/brandoffScraper.ts`:

`https://brandoffbuyingclub.com/collections/chanel-bags-collection`

Scraping uses Shopify SSR embedded JSON (`ShopifyAnalytics.meta.products`) with DOM fallback.
