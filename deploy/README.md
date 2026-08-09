# INSPO — Production Deployment Guide

Deploy the two-storefront platform (shop1 + baseline) to a VPS with HTTPS, strong
secrets, and your existing database/media intact.

```
Browser ── HTTPS ──► Caddy (automatic TLS) ──► frontend:80  (shop1 storefront + /admin)
                                              ├─► frontend-baseline:80 (baseline storefront + /admin)
                                              └─► minio:9000 (media.<domain>)
                             backend:8000 ◄──┘ (proxied via each frontend's nginx)
```

In production only ports `80`/`443` are published. The backend API and MinIO
(S3 + console) are internal to the Docker network.

---

## 1. Prerequisites

**On your Mac (packaging machine):**
- Docker Desktop running (stack up: `docker compose up -d`)
- `zip` and `openssl` (both preinstalled on macOS)

**On the VPS:**
- Docker Engine + Docker Compose **v2** (`docker compose version` shows v2.x)
- Ports `80` and `443` reachable (firewall open)
- A domain you control, with DNS access to create subdomains

---

## 2. Point DNS first

Create A-records for these three hostnames → your VPS IP (start this early — Let's
Encrypt only issues once DNS resolves):

| Hostname                    | Purpose                            |
| --------------------------- | ---------------------------------- |
| `shop1.example.com`         | Storefront #1 (INSPO) + its admin  |
| `baseline.example.com`      | Storefront #2 (BASELINE CLUB) + admin |
| `media.example.com`         | Serves uploaded images from MinIO  |

---

## 3. Deploy steps

### Step 1 — On your Mac: package the app + your data

```bash
bash deploy/package.sh
```

This snapshots your current database and uploaded media into `deploy/backup/` and
builds `inspo-deploy.zip`. Re-run it whenever you've changed content in the admin.

### Step 2 — Upload to the VPS

```bash
scp inspo-deploy.zip user@YOUR_VPS_IP:~
```

### Step 3 — On the VPS: unzip + configure

```bash
mkdir -p ~/inspo && cd ~/inspo
unzip ~/inspo-deploy.zip
```

The zip extracts the project into the current folder (no nested directory).

### Step 4 — Generate the production `.env`

```bash
bash deploy/setup.sh
```

It prompts for the two storefront domains, the media hostname (defaults to
`media.<shop1>`), and your Let's Encrypt email, then generates strong random
secrets and writes `.env`.

### Step 5 — Build & start the stack

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The backend **refuses to start** in production if any secret is weak or missing —
this catches a forgotten/mis-typed `.env`.

### Step 6 — Restore your data (only if you exported a backup)

```bash
bash deploy/import-data.sh
```

Restores the database and MinIO media into the Docker volumes and restarts the
backend. Media URLs are rewritten to `https://media.<domain>` automatically.

### Step 7 — Secure the admin accounts

The restored database still has the pre-deploy password (`admin` / `admin123`).
There is no UI to change it, so run this once on the VPS:

```bash
docker exec -i inspo-backend python - <<'EOF'
from app.database import SessionLocal
from app.models import User
from app.security import hash_password
from sqlalchemy import select

NEW_PASSWORD = "ChangeThis-Strong-Password-1!"   # <- your new admin password
db = SessionLocal()
users = db.scalars(select(User)).all()
for user in users:
    user.password_hash = hash_password(NEW_PASSWORD)
db.commit()
print(f"Password updated for {len(users)} admin user(s).")
EOF
```

> On a **fresh** database (no backup imported), each tenant's `admin` password is
> `ADMIN_DEFAULT_PASSWORD` from `.env` — printed at the end of `setup.sh`.

### Step 8 — Verify

```bash
curl -s https://shop1.example.com/api/health          # {"status":"ok"}
curl -s https://baseline.example.com/api/health       # {"status":"ok"}

# Verify media serves (grab a real image URL from the API, then check it loads):
IMG=$(curl -s https://shop1.example.com/api/home | grep -oE 'https://[^"]*inspo-media/media/[^"]+' | head -1)
echo "$IMG"
curl -sI "$IMG" | head -1                            # HTTP/1.1 200 OK
```

Open `https://shop1.example.com` and `https://shop1.example.com/admin`, then repeat
for the baseline domain. If HTTPS is not working yet, wait for DNS propagation and
check Caddy: `docker logs inspo-caddy`.

---

## 4. `.env` reference

| Variable               | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `ENVIRONMENT`          | `production` (enables secret validation + fail-fast)     |
| `SHOP1_DOMAIN`         | Storefront #1 hostname                                   |
| `BASELINE_DOMAIN`      | Storefront #2 hostname                                   |
| `MEDIA_DOMAIN`         | Media hostname (images)                                  |
| `CERT_EMAIL`           | Let's Encrypt account email                              |
| `CORS_ORIGINS`         | Browser origins allowed to call the API directly         |
| `TRUSTED_HOSTS`        | Backend Host allowlist (DNS-rebinding protection)        |
| `JWT_SECRET`           | Signs admin session tokens                               |
| `MINIO_ROOT_USER`      | MinIO admin username                                     |
| `MINIO_ROOT_PASSWORD`  | MinIO admin password (also used by the backend)          |
| `ADMIN_DEFAULT_PASSWORD` | Initial admin password for tenants created on a fresh DB |

---

## 5. Updating / redeploying

```bash
# On your Mac — re-export data + rebuild package
bash deploy/package.sh
scp inspo-deploy.zip user@VPS:~

# On the VPS
cd ~/inspo
unzip -o ~/inspo-deploy.zip
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
bash deploy/import-data.sh   # only needed if you re-exported newer content
```

Your `.env` is kept on the VPS and is **not** overwritten by the zip.

---

## 6. Backup & restore

Your data lives in Docker volumes, not the repo:

- `inspoxbaseline_backend-data` → `/data/inspo.db` (SQLite database)
- `inspoxbaseline_minio-data` → `/data/inspo-media` (uploaded images)

`deploy/package.sh` already bundles both. For an on-VPS backup without a full package:

```bash
docker exec inspo-backend python -c "import sqlite3; s=sqlite3.connect('/data/inspo.db'); d=sqlite3.connect('/data/bak.db'); s.backup(d); d.close(); s.close()"
docker cp inspo-backend:/data/bak.db ~/backup-inspo.db
docker run --rm --volumes-from inspo-minio -v "$HOME":/backup alpine tar czf /backup/minio-media.tar.gz -C /data inspo-media
```

---

## 7. Troubleshooting

| Symptom                                          | Fix                                                        |
| ------------------------------------------------ | ---------------------------------------------------------- |
| Backend container exits / no `/api/health`       | Read `docker logs inspo-backend` — prod secret validation failed; fix `.env` |
| `502` from Caddy                                 | Backend not ready yet; wait, then `docker logs inspo-caddy` |
| Certificate not issued (Caddy logs an ACME error/timeout) | DNS not propagated; verify A-records, then `docker restart inspo-caddy` |
| Images broken                                    | `curl -sI https://media.<domain>/inspo-media/...`; check `MINIO_PUBLIC_URL` and that `import-data.sh` restored the bucket |
| `429 Too many login attempts`                    | Admin login rate limit (10 per 5 min); wait and try again   |
| `invalid or unknown compose file`                | Compose v2 required (`docker compose version`)              |
| Ports already in use (`bind: address already in use`) | Stop nginx/Apache on the VPS or change `80`/`443` mappings |

---

## 8. Security checklist

- [ ] All secrets generated by `setup.sh` (never commit `.env` to git)
- [ ] `ENVIRONMENT=production` in `.env`
- [ ] Admin passwords changed after import (Step 7)
- [ ] Firewall: only `80`/`443` open to the internet
- [ ] DNS-rebinding protected: `TRUSTED_HOSTS` lists your real domains
- [ ] Regular backups via `deploy/package.sh`
