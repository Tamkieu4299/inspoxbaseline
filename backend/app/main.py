from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from contextlib import asynccontextmanager

from .config import settings
import os

from .routers import admin, admin_users, auth, media, public, tenants
from .routers.auctions import admin_router as auctions_admin_router
from .routers.auctions import public_router as auctions_public_router
from .routers.inspo_bridge import router as inspo_bridge_router
from .tamhub_sync import start_background_sync


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sync orchestration lives in TamHub worker-service; legacy Inspo thread is opt-in only.
    if os.getenv("TAMHUB_SYNC_LEGACY_IN_PROCESS", "").lower() in ("1", "true", "yes"):
        start_background_sync()
    yield


app = FastAPI(title="Storefront API", version="1.0.0", lifespan=lifespan)

# Middleware stack: first add_middleware call = outermost.
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.TRUSTED_HOSTS_LIST,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(auctions_public_router)
app.include_router(auctions_admin_router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(media.router)
app.include_router(tenants.router)
app.include_router(admin_users.router)
app.include_router(inspo_bridge_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
