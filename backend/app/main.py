from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from contextlib import asynccontextmanager

from .config import settings
from .routers import admin, admin_users, auth, media, public, tenants
from .routers.tamhub_sync_admin import integration_router
from .tamhub_sync import start_background_sync


@asynccontextmanager
async def lifespan(app: FastAPI):
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
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(media.router)
app.include_router(tenants.router)
app.include_router(admin_users.router)
app.include_router(integration_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
