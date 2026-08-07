import os


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/inspo.db")
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "inspo-media")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    ADMIN_API_KEY: str = os.getenv("ADMIN_API_KEY", "inspo-admin-secret")
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:8080"
    )

    @property
    def public_base_url(self) -> str:
        return os.getenv("MINIO_PUBLIC_URL", f"http://{self.MINIO_ENDPOINT}")


settings = Settings()
