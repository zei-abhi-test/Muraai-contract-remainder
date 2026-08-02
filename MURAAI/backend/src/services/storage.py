"""Storage provider abstraction for document management.

Provides a uniform interface for storing and retrieving documents across
different backends (local filesystem, OneDrive, etc.). The application
defaults to local storage and falls back gracefully if OneDrive is
unavailable.
"""

import abc
import os
import uuid
from typing import BinaryIO, Optional, Tuple

from flask import current_app
from werkzeug.utils import secure_filename

from src.services.logging_config import get_structured_logger

logger = get_structured_logger(__name__)


def get_upload_root():
    """Return the configured upload root directory."""
    if os.getenv("FLASK_ENV") == "testing" or current_app.config.get("TESTING"):
        return os.path.join("C:\\tmp", "muraai-contract-uploads")
    return current_app.config.get(
        "UPLOAD_FOLDER",
        os.path.join(current_app.instance_path, "uploads"),
    )


def generate_stored_filename(original_name: str) -> str:
    return f"{uuid.uuid4().hex}_{secure_filename(original_name)}"


class StorageProvider(abc.ABC):
    """Abstract base for document storage backends."""

    @abc.abstractmethod
    def save(self, file_obj: BinaryIO, stored_name: str) -> Tuple[str, Optional[str]]:
        """Save a file, return (file_path, storage_reference)."""

    @abc.abstractmethod
    def open(self, file_path: str) -> Optional[BinaryIO]:
        """Open a file for reading (streaming)."""

    @abc.abstractmethod
    def delete(self, file_path: str, storage_reference: Optional[str] = None) -> bool:
        """Delete a stored file."""

    @abc.abstractmethod
    def get_download_url(self, file_path: str, storage_reference: Optional[str] = None) -> Optional[str]:
        """Get a downloadable URL for the file (or None for local files)."""


class LocalStorageProvider(StorageProvider):
    """Stores files on the local filesystem."""

    def save(self, file_obj: BinaryIO, stored_name: str) -> Tuple[str, Optional[str]]:
        upload_root = get_upload_root()
        os.makedirs(upload_root, exist_ok=True)
        file_path = os.path.join(upload_root, stored_name)
        file_obj.save(file_path)
        logger.info("File saved locally", context={"path": file_path})
        return file_path, None

    def open(self, file_path: str) -> Optional[BinaryIO]:
        if not os.path.exists(file_path):
            logger.warning("Local file not found", context={"path": file_path})
            return None
        return open(file_path, "rb")

    def delete(self, file_path: str, storage_reference: Optional[str] = None) -> bool:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info("Local file deleted", context={"path": file_path})
                return True
            return False
        except Exception as exc:
            logger.error("Failed to delete local file", context={"error": str(exc)})
            return False

    def get_download_url(self, file_path: str, storage_reference: Optional[str] = None) -> Optional[str]:
        return None


class OneDriveStorageProvider(StorageProvider):
    """Stores files via Microsoft OneDrive."""

    def __init__(self):
        self._onedrive = None
        self._available = False
        self._init_provider()

    def _init_provider(self):
        try:
            from src.services.microsoft.graph_client import GraphClient
            from src.services.microsoft.onedrive import GraphOneDriveProvider
            tenant = os.getenv("AZURE_TENANT_ID")
            client_id = os.getenv("AZURE_CLIENT_ID")
            client_secret = os.getenv("AZURE_CLIENT_SECRET")
            if tenant and client_id and client_secret:
                client = GraphClient(tenant, client_id, client_secret)
                self._onedrive = GraphOneDriveProvider(client)
                self._available = True
                logger.info("OneDrive storage provider initialized")
            else:
                logger.warning("OneDrive credentials not configured, falling back to local storage")
        except Exception as exc:
            logger.warning("OneDrive initialization failed", context={"error": str(exc)})

    def is_available(self) -> bool:
        return self._available

    def save(self, file_obj: BinaryIO, stored_name: str) -> Tuple[str, Optional[str]]:
        if not self._available or not self._onedrive:
            return LocalStorageProvider().save(file_obj, stored_name)
        local = LocalStorageProvider()
        file_path, _ = local.save(file_obj, stored_name)
        dest = f"/MuraaiDocuments/{stored_name}"
        result = self._onedrive.upload_file(file_path, dest)
        ref = result.get("id") if result else None
        return file_path, ref

    def open(self, file_path: str) -> Optional[BinaryIO]:
        if os.path.exists(file_path):
            return open(file_path, "rb")
        return None

    def delete(self, file_path: str, storage_reference: Optional[str] = None) -> bool:
        local_ok = LocalStorageProvider().delete(file_path)
        if self._available and self._onedrive and storage_reference:
            self._onedrive.delete_file(storage_reference)
        return local_ok

    def get_download_url(self, file_path: str, storage_reference: Optional[str] = None) -> Optional[str]:
        if self._available and self._onedrive and storage_reference:
            return self._onedrive.get_share_link(storage_reference, link_type="view")
        return None


def get_storage_provider() -> StorageProvider:
    """Factory: return the configured storage provider (OneDrive if
    available, otherwise local)."""
    provider = os.getenv("STORAGE_PROVIDER", "local").lower()
    if provider == "onedrive":
        od = OneDriveStorageProvider()
        if od.is_available():
            return od
        logger.warning("OneDrive requested but unavailable, falling back to local")
    return LocalStorageProvider()
