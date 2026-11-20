# Baseline auctions (tenant-gated)

## Enable (per tenant)

1. **Admin → Site** → check **Enable bidding**, set **order notification email** (bid alerts), optional **Zalo webhook URL**.
2. **Admin → Navigation** → add **Auctions** item (only works when bidding is enabled).
3. **Admin → Auctions** → pick a racket product, set starting bid, step, end time, status **live**, **published**.

Storefront: `/auctions` and `/auctions/{product-slug}`.

## Email

Uses existing SMTP (`SMTP_*` in `.env`). Shop + bidder (if email provided) on:

- `bid_placed`, `outbid`, `won`, `lost`, `reserve_not_met`

## Zalo (bridge)

Until Zalo ZNS/OA is configured, POST JSON to your webhook:

```json
{
  "event": "bid_placed",
  "product_slug": "…",
  "lot_title": "…",
  "amount_vnd": 5500000,
  "bidder_phone": "+84…",
  "message_vi": "…"
}
```

Set per-tenant **Zalo webhook URL** in Site settings, or server-wide `ZALO_WEBHOOK_URL` / `ZALO_WEBHOOK_SECRET` in `.env`.

## Deploy

After `git pull`, rebuild backend/frontend. On first boot, `app.seed` creates `auction_lots` / `auction_bids` tables and site columns.

```bash
docker exec inspo-backend python -c "from app.seed import _migrate_existing; from app.database import SessionLocal; db=SessionLocal(); _migrate_existing(db); db.close()"
```