import os

_WEAK_JWT = {"inspo-jwt-secret-change-me", "inspo-jwt-secret-change-me-in-production"}
_WEAK_MINIO = {"minioadmin", "your-secret-key", "change-me"}
_WEAK_ADMIN_PW = {"admin123", "changeme"}


class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/inspo.db")
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "inspo-media")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    # Browser-accessible base URL for uploaded media (MinIO public bucket).
    MINIO_PUBLIC_URL: str = os.getenv("MINIO_PUBLIC_URL", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "inspo-jwt-secret-change-me")
    JWT_EXPIRES_MINUTES: int = int(os.getenv("JWT_EXPIRES_MINUTES", "1440"))
    ADMIN_DEFAULT_PASSWORD: str = os.getenv("ADMIN_DEFAULT_PASSWORD", "admin123")
    DEFAULT_TENANT_SLUG: str = os.getenv("DEFAULT_TENANT_SLUG", "shop1")
    # Comma-separated browser origins allowed to call the API directly (same-origin
    # storefronts proxied through nginx do NOT need to be listed).
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:8080"
    )
    # Optional extra origin regex (dev default covers *.localhost). Empty => disabled.
    CORS_ORIGIN_REGEX: str = os.getenv(
        "CORS_ORIGIN_REGEX", r"^https?://(?:[a-z0-9-]+\.)*localhost(?::\d+)?$"
    )
    # Comma-separated Host allowlist for the backend. "*" disables the check (dev only).
    TRUSTED_HOSTS: str = os.getenv("TRUSTED_HOSTS", "*")

    @property
    def TRUSTED_HOSTS_LIST(self) -> list[str]:
        hosts = [h.strip() for h in self.TRUSTED_HOSTS.split(",") if h.strip()]
        return hosts if hosts else ["*"]

    @property
    def public_base_url(self) -> str:
        return self.MINIO_PUBLIC_URL or f"http://{self.MINIO_ENDPOINT}"

    def __init__(self) -> None:
        if self.ENVIRONMENT.lower() != "production":
            return
        errors: list[str] = []
        if self.JWT_SECRET in _WEAK_JWT or len(self.JWT_SECRET) < 32:
            errors.append(
                "JWT_SECRET must be a strong random value (>=32 chars); generate with: openssl rand -hex 32"
            )
        if self.MINIO_SECRET_KEY in _WEAK_MINIO or len(self.MINIO_SECRET_KEY) < 16:
            errors.append(
                "MINIO_SECRET_KEY must be a strong random value (>=16 chars)"
            )
        if self.ADMIN_DEFAULT_PASSWORD in _WEAK_ADMIN_PW or len(self.ADMIN_DEFAULT_PASSWORD) < 10:
            errors.append(
                "ADMIN_DEFAULT_PASSWORD must be a strong random value (>=10 chars)"
            )
        if not self.MINIO_PUBLIC_URL.startswith("https://"):
            errors.append("MINIO_PUBLIC_URL must be an https:// URL in production")
        if not self.TRUSTED_HOSTS_LIST or self.TRUSTED_HOSTS_LIST == ["*"]:
            errors.append(
                "TRUSTED_HOSTS must be an explicit comma-separated host allowlist in production"
            )
        if errors:
            raise RuntimeError(
                "Production configuration is insecure:\n- " + "\n- ".join(errors)
            )


settings = Settings()
