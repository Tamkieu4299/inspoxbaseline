from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import admin, auth, media, public, tenants

app = FastAPI(title="INSPO Storefront API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_origin_regex=r"^https?://(?:[a-z0-9-]+\.)*localhost(?::\d+)?$",
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
