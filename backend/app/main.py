from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import settings
from .routers import admin, auth, media, public, tenants

app = FastAPI(title="Storefront API", version="1.0.0")

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


@app.get("/api/health")
def health():
    return {"status": "ok"}
