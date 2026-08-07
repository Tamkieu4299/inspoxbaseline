import io
import json
import uuid
from pathlib import Path

from minio import Minio
from sqlalchemy.orm import Session

from .config import settings
from .models import Media

_client: Minio | None = None


def get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
    return _client


def ensure_bucket() -> str:
    client = get_client()
    bucket = settings.MINIO_BUCKET
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{bucket}/*"],
            }
        ],
    }
    try:
        client.set_bucket_policy(bucket, json.dumps(policy))
    except Exception:
        pass
    return bucket


def save_file(db: Session, content: bytes, filename: str, content_type: str) -> Media:
    bucket = ensure_bucket()
    ext = Path(filename).suffix.lower() or ".bin"
    object_key = f"media/{uuid.uuid4().hex}{ext}"
    client = get_client()
    client.put_object(
        bucket,
        object_key,
        __import__("io").BytesIO(content),
        length=len(content),
        content_type=content_type,
    )
    url = f"{settings.public_base_url}/{bucket}/{object_key}"
    media = Media(
        filename=filename,
        object_key=object_key,
        url=url,
        content_type=content_type,
        size=len(content),
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


def replace_file(db: Session, media: Media, content: bytes, content_type: str) -> Media:
    """Overwrite an existing media object in place, preserving its URL and ID."""
    bucket = settings.MINIO_BUCKET
    get_client().put_object(
        bucket,
        media.object_key,
        io.BytesIO(content),
        length=len(content),
        content_type=content_type,
    )
    media.content_type = content_type
    media.size = len(content)
    db.commit()
    db.refresh(media)
    return media
