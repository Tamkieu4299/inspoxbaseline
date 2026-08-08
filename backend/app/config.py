import os


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/inspo.db")
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "inspo-media")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    ADMIN_API_KEY: str = os.getenv("ADMIN_API_KEY", "inspo-admin-secret")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "inspo-jwt-secret-change-me")
    JWT_EXPIRES_MINUTES: int = int(os.getenv("JWT_EXPIRES_MINUTES", "1440"))
    ADMIN_DEFAULT_PASSWORD: str = os.getenv("ADMIN_DEFAULT_PASSWORD", "admin123")
    DEFAULT_TENANT_SLUG: str = os.getenv("DEFAULT_TENANT_SLUG", "shop1")
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:8080"
    )

    @property
    def public_base_url(self) -> str:
        return os.getenv("MINIO_PUBLIC_URL", f"http://{self.MINIO_ENDPOINT}")


settings = Settings()
