# INSPO — Quiet Luxury Tennis Storefront

Full-stack e-commerce experience for **INSPO** (Engineered for the Court), built from the
designs in `designs/v1` and the [product brief](docs/product_briefs.md).

- **Frontend:** React 18 + Vite + TypeScript + Tailwind (Chivo / Hanken Grotesk, Material Symbols)
- **Backend:** FastAPI + SQLAlchemy (admin API + storefront API)
- **Media:** MinIO (S3-compatible) for image/asset uploads
- **Pages:** Homepage, Collection listing, Product detail, Brand Experience, and a content Admin
- **Admin CMS:** configure products, collections, media, homepage content, and brand editorial content

## Quick start (Docker)

```bash
docker compose up --build
```

Then open:

| Service       | URL                          |
| ------------- | ---------------------------- |
| Storefront    | http://localhost:3000        |
| Backend API   | http://localhost:8000/docs   |
| MinIO console | http://localhost:9001        |
| Admin CMS     | http://localhost:3000/admin  |

MinIO credentials: `minioadmin` / `minioadmin` (console + S3).
Admin login: `admin` / `admin123`.

The database is seeded automatically on first boot with the v1 design content
(categories, collections, products, homepage, brand editorial). Products reference the
design's remote imagery; upload your own assets through the Admin → Media tab and they are
stored in MinIO.

> **Local-only defaults.** The values above are development defaults. For anything shared
> or deployed, override every secret via a `.env` file (see `.env.example`) — the backend
> **refuses to start** with weak/placeholder secrets when `ENVIRONMENT=production`.

## Deployment (VPS)

The `docker-compose.prod.yml` override puts **Caddy** in front with automatic HTTPS
(Let's Encrypt), stops publishing the backend/MinIO ports to the host, and enforces
strong secrets.

```bash
# 1. Point DNS for your storefront domains at the VPS, e.g.:
#    shop1.example.com, baseline.example.com, media.example.com

# 2. Prepare the production env file
cp deploy/.env.prod.example .env
#    fill in real domains, CERT_EMAIL, and secrets (openssl rand -hex 32)

# 3. Build & start
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4. Reset each tenant's admin password (the copied DB still has the pre-deploy one):
#    log in at https://shop1.example.com/admin, then Admin -> Tenants -> reset password.
```

Notes:
- **Secrets** — `JWT_SECRET`, `MINIO_ROOT_PASSWORD`, `ADMIN_DEFAULT_PASSWORD` are read
  from `.env`; the backend fails fast in production if they are weak or missing.
- **Ports** — only `80`/`443` are published. Backend, MinIO S3 and the MinIO console are
  internal-only (use an SSH tunnel for the console if needed).
- **Media URLs** — stored URLs are rewritten to `MINIO_PUBLIC_URL` (`https://media.<domain>`)
  automatically on backend boot.
- **CORS** — storefronts are served same-origin through nginx, so cross-origin calls are not
  needed. `CORS_ORIGINS` should be a tight list of your real domains.
- **Login protection** — the admin login endpoint is rate-limited (10 attempts / 5 min per
  IP+username).

## Local development (hot reload)

Recommended dev loop — **backend in Docker with auto-restart**, **frontend on your host with Vite HMR**:

```bash
# 1. Start MinIO + backend (backend code is volume-mounted, uvicorn --reload picks up edits instantly)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up minio backend

# 2. Run the frontend locally (hot reload on save)
cd frontend
npm install
npm run dev            # -> http://localhost:5173, /api is proxied to http://localhost:8000
```

Edit `backend/app/**` → the API restarts automatically. Edit `frontend/src/**` → the page updates instantly.
Media uploads go to the Docker MinIO (http://localhost:9000), same as production.

Stop everything: `docker compose -f docker-compose.yml -f docker-compose.dev.yml down`

Production-style (everything in Docker, no hot reload): `docker compose up --build`

All-local alternative (no Docker at all — run MinIO on your host or use Docker only for MinIO):

```bash
docker compose up -d minio    # just the object store, optional for uploads

cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.seed
.venv/bin/uvicorn app.main:app --reload --port 8000

cd frontend
npm install
npm run dev   # http://localhost:5173, proxies /api -> localhost:8000
```

## Project structure

```
backend/
  app/
    models.py          # SQLAlchemy models (Media, Category, Collection, Product, EditorialItem, HomeContent)
    schemas.py         # Pydantic schemas
    routers/
      public.py        # Storefront API  (/api/home, /api/collections, /api/products, /api/brand)
      admin.py         # Admin CRUD API  (/api/admin/*, JWT-protected)
      media.py         # Image upload to MinIO
    seed.py            # Idempotent seed of the v1 design content
    minio_client.py    # MinIO helpers (bucket + public policy + upload)
frontend/
  src/
    pages/             # Home, Collection, ProductDetail, BrandExperience
    admin/             # CMS (products, collections, media, homepage, brand, categories)
    components/        # Navbar, Footer, ProductCard, Icon
    api.ts             # API client
    types.ts           # Shared TypeScript types
```

## Content model

- **Collection** — a curated group of products (slug, name, tagline, hero image, featured flag).
  Featured collections power the homepage "trending" bento grid.
- **Product** — name, slug, price, category, collection, badge (NEW/LIMITED/BESTSELLER),
  colorways, sizes, tech specs, engineering features, and ordered images.
- **Media** — uploaded assets stored in MinIO, referenced by products, collections, and pages.
- **HomeContent** — hero banner, trending/latest-drop section titles, "Master the Game" block.
- **EditorialItem** — brand experience masonry items (image, quote, or 2-up image grid).

## Storefront API summary

| Endpoint                 | Description                          |
| ------------------------ | ------------------------------------ |
| `GET /api/home`          | Composed homepage sections           |
| `GET /api/collections`   | Active collections with products     |
| `GET /api/collections/:slug` | Single collection               |
| `GET /api/products`      | Products with filters & sort         |
| `GET /api/products/:slug`| Single product                       |
| `GET /api/brand`         | Brand experience editorial content   |
| `GET /api/categories`    | Categories                           |
| `GET /api/health`        | Health check                         |

Admin endpoints live under `/api/admin/*` and require a JWT from `/api/admin/auth/login`.
Interactive docs: http://localhost:8000/docs
