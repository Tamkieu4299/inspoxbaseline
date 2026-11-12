# TamHub on the same VPS as inspoXbaseline

Two **inspo** tenants (`shop1`, `baseline`) map to two **TamHub** ecommerce tenants (same subdomains). Shared data:

| Data | Source of truth (storefront) | TamHub copy |
|------|------------------------------|-------------|
| Product catalog | inspo SQLite + MinIO | Synced SKUs/variants (`scripts/setup-inspo-integration.ts`) |
| Customers & orders | Checkout on inspo | Created/updated via order webhook |

## 1. Create shared Docker network (once)

```bash
docker network create inspo-tamhub
```

## 2. inspo stack (unchanged flow)

```bash
cd ~/inspo
docker network create inspo-tamhub 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.tamhub-network.yml up -d --build
```

## 3. TamHub stack (coexist override)

```bash
cd ~/tamhub
cp deploy/inspo-coexist.env.example .env   # after first integration setup
docker compose -f docker-compose.yml -f docker-compose.vps-coexist.yml up -d --build
```

Host ports (defaults):

| Service | URL |
|---------|-----|
| TamHub API gateway | `http://VPS_IP:8180` |
| Inspo shop1 | `http://VPS_IP:3000` |
| Inspo baseline | `http://VPS_IP:3001` |

## 4. Seed tenants + sync catalog

From your laptop or the VPS (with both stacks up):

```bash
cd ~/tamhub
npm install
API_BASE_URL=http://127.0.0.1:8180/api/v1 \
INSPO_API_URL=http://127.0.0.1:8000 \
npx ts-node scripts/setup-inspo-integration.ts
```

Copy printed `INSPO_TENANT_MAP` and shared secret into `~/tamhub/.env`, then restart service-management:

```bash
docker compose -f docker-compose.yml -f docker-compose.vps-coexist.yml up -d service-management-service
```

## 5. Wire inspo webhooks

Inspo signs the raw JSON body (`X-Inspo-Signature`). The TamHub **API gateway re-serializes** JSON when proxying, so webhooks must target **service-management** on the shared Docker network (default in `configure-tamhub-integration.sh`):

`http://tamhub-service-management-service:3004/api/v1/integrations/inspo/orders`

```bash
cd ~/inspo
ORDER_WEBHOOK_SECRET='your-long-random-secret' bash deploy/configure-tamhub-integration.sh
docker compose -f docker-compose.yml -f docker-compose.tamhub-network.yml up -d backend
```

Set the **same** secret in TamHub `.env` as `INSPO_WEBHOOK_SECRET`, and `INSPO_TENANT_MAP` from `deploy/inspo-tenant-map.json` after catalog sync.

TamHub API for humans / frontend: `http://VPS:8180` (ensure `api-gateway` publishes `8180:8080`; do not use `ports: !reset` on gateway in the coexist compose overlay).

TamHub UI on VPS (Docker):

```bash
cd ~/tamhub
docker compose -f docker-compose.yml -f docker-compose.vps-coexist.yml up -d --build frontend
```

Open **http://VPS:8181** — nginx serves the React app and proxies `/api/` to the API gateway. Login: `admin@tamhub.com` / `Admin@123`.

API-only / Swagger: **http://VPS:8180/api/docs**

## RAM note

Running **both** full stacks on **2 GB** RAM is tight. Prefer **4 GB+** or disable TamHub monitoring profile (already off in `docker-compose.vps-coexist.yml`).

## Ongoing catalog sync (automatic)

When `TAMHUB_SYNC_ENABLED=true` on **inspo-backend** (same `INSPO_TENANT_MAP` + `ORDER_WEBHOOK_SECRET` / `INSPO_CATALOG_SYNC_SECRET` as TamHub):

- **On a timer (default 15 min):** Inspo → TamHub catalog (name, price, images, variants) and TamHub inventory → Inspo grip availability.
- **After Admin product save:** debounced catalog push for that tenant.

**Change the timer (e.g. 10 min) without redeploy**

1. **Inspo Admin** (super-admin) → **TamHub sync** → pick **10 min** → Save; or
2. **TamHub** Super Admin → **Inspo catalog sync** (needs `INSPO_BACKEND_URL` + `INSPO_CATALOG_SYNC_SECRET` on service-management); or
3. Env default: `TAMHUB_SYNC_INTERVAL_SECONDS=600` in `~/inspo/.env` (used until overridden in the UI; state in `/data/tamhub_sync_state.json`).

From either UI you can **Run sync now**, see **last error**, and toggle inventory pull.

Manual script (`run-inspo-sync-on-vps.sh`) is optional for one-off backfills.

### Who edits what

| Concern | App |
|--------|-----|
| Product merchandising (price, copy, images, PDP) | **Inspo Admin** only |
| Stock counts, COGS, revenue reports, fulfillment | **TamHub** |
| Web checkout price / line totals | **Inspo order snapshot** → TamHub order lines (exact `unit_price`, `image_url`) |

TamHub blocks price/name/image edits on SKUs `inspo:*` unless the request carries `X-Inspo-Catalog-Sync` (automatic sync only).
