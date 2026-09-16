"""Object storage abstraction for uploads and generated documents."""

from __future__ import annotations

import abc
from functools import lru_cache
from pathlib import Path

from app.config import settings


class StorageProvider(abc.ABC):
    name = "base"

    @abc.abstractmethod
    def write(self, key: str, data: bytes) -> str: ...

    @abc.abstractmethod
    def read(self, key: str) -> bytes: ...

    @abc.abstractmethod
    def exists(self, key: str) -> bool: ...


class LocalStorage(StorageProvider):
    name = "local"

    def __init__(self) -> None:
        self.root = settings.storage_path
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # Keys come from user-supplied filenames; keep them inside the root.
        safe = Path(key.replace("..", "_")).as_posix().lstrip("/")
        path = (self.root / safe).resolve()
        if not str(path).startswith(str(self.root.resolve())):
            raise ValueError(f"Refusing to write outside storage root: {key}")
        return path

    def write(self, key: str, data: bytes) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).exists()


class S3Storage(StorageProvider):
    name = "s3"

    def __init__(self) -> None:
        import boto3  # imported lazily; only needed for the S3 backend

        self._client = boto3.client(
            "s3", region_name=settings.s3_region or None,
            endpoint_url=settings.s3_endpoint_url or None,
        )
        self._bucket = settings.s3_bucket

    def write(self, key: str, data: bytes) -> str:
        self._client.put_object(Bucket=self._bucket, Key=key, Body=data)
        return key

    def read(self, key: str) -> bytes:
        return self._client.get_object(Bucket=self._bucket, Key=key)["Body"].read()

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
            return True
        except ClientError:
            return False


@lru_cache
def get_storage() -> StorageProvider:
    if settings.storage_provider == "s3":
        return S3Storage()
    return LocalStorage()
