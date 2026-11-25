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

**TamHub worker-service** schedules Inspo catalog jobs (default **60 min**; one job **per store** — shop1, baseline):

- Pull catalog JSON from Inspo export API → upsert TamHub products/variants (`X-Inspo-Catalog-Sync`).
- Optionally pull TamHub inventory → Inspo grip `available` flags.
- Progress and errors appear on **TamHub → Jobs** (Inspo catalog filter).

**Change the timer (e.g. 10 min) without redeploy**

1. **TamHub** → **Jobs** (`/jobs`) → **Inspo catalog** tab; super-admin sees **Inspo ↔ TamHub sync** settings (interval, run now).
2. Env on worker-service: `INSPO_SYNC_INTERVAL_MINUTES`, `INSPO_SYNC_ENABLED`, `INSPO_BACKEND_URL`, `INSPO_CATALOG_SYNC_SECRET`, `INSPO_TENANT_MAP`.

Inspo **no longer** runs the background sync thread unless `TAMHUB_SYNC_LEGACY_IN_PROCESS=true`. Inspo exposes **catalog export** and **inventory patch** APIs only.

Manual script (`run-inspo-sync-on-vps.sh`) is optional for one-off backfills.

### Who edits what

| Concern | App |
|--------|-----|
| Product merchandising (price, copy, images, PDP) | **Inspo Admin** only |
| Stock counts, COGS, revenue reports, fulfillment | **TamHub** |
| Web checkout price / line totals | **Inspo order snapshot** → TamHub order lines (exact `unit_price`, `image_url`) |

TamHub blocks price/name/image edits on SKUs `inspo:*` unless the request carries `X-Inspo-Catalog-Sync` (automatic sync only). Set `INSPO_CATALOG_LOCK_MERCH=false` on **customer-service** to allow manual product edits in TamHub (storefront still reads from Inspo until you run catalog sync).
