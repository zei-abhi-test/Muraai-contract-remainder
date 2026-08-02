from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from src.services.microsoft.graph_client import GraphClient
from src.services.microsoft.interfaces import OneDriveProvider
from src.services.logging_config import get_structured_logger

logger = get_structured_logger(__name__)


class GraphOneDriveProvider(OneDriveProvider):
    """OneDrive provider backed by the Microsoft Graph API."""

    def __init__(self, client: GraphClient) -> None:
        self._client = client

    def is_available(self) -> bool:
        return True

    def upload_file(
        self, file_path: str, destination_path: str, /, **kwargs: Any
    ) -> Optional[Dict[str, Any]]:
        if not os.path.isfile(file_path):
            logger.error("File not found", context={"path": file_path})
            return None
        try:
            file_name = os.path.basename(destination_path)
            parent = os.path.dirname(destination_path).replace("\\", "/") or "/"
            with open(file_path, "rb") as f:
                data = f.read()
            upload_path = f"/me/drive/root:{parent}/{file_name}:/content"
            result = self._client.put(upload_path, data=data)
            logger.info("File uploaded to OneDrive", context={"name": file_name})
            return result
        except Exception as exc:
            logger.error("OneDrive upload failed", context={"error": str(exc)})
            return None

    def download_file(self, file_id: str, destination_path: str, /) -> Optional[str]:
        try:
            meta = self._client.get(f"/me/drive/items/{file_id}")
            download_url = meta.get("@microsoft.graph.downloadUrl")
            if not download_url:
                logger.error("No download URL in metadata")
                return None
            import requests as req
            resp = req.get(download_url, timeout=60)
            resp.raise_for_status()
            os.makedirs(os.path.dirname(destination_path) or ".", exist_ok=True)
            with open(destination_path, "wb") as f:
                f.write(resp.content)
            logger.info("File downloaded from OneDrive", context={"file_id": file_id})
            return destination_path
        except Exception as exc:
            logger.error("OneDrive download failed", context={"error": str(exc)})
            return None

    def list_files(
        self, folder_path: str = "/", /, **kwargs: Any
    ) -> List[Dict[str, Any]]:
        try:
            path = folder_path if folder_path != "/" else ""
            resp = self._client.get(f"/me/drive/root:{path}:/children")
            return resp.get("value", [])
        except Exception as exc:
            logger.error("OneDrive list failed", context={"error": str(exc)})
            return []

    def delete_file(self, file_id: str, /) -> bool:
        try:
            self._client.delete(f"/me/drive/items/{file_id}")
            return True
        except Exception as exc:
            logger.error("OneDrive delete failed", context={"error": str(exc)})
            return False

    def get_share_link(self, file_id: str, /, **kwargs: Any) -> Optional[str]:
        try:
            body = {"type": kwargs.get("link_type", "view"), "scope": "organization"}
            resp = self._client.post(
                f"/me/drive/items/{file_id}/createLink", json=body
            )
            return resp.get("link", {}).get("webUrl")
        except Exception as exc:
            logger.error("OneDrive share-link creation failed", context={"error": str(exc)})
            return None


class NullOneDriveProvider(OneDriveProvider):
    """Placeholder provider returned when OneDrive credentials are missing.

    Every method logs a warning and returns a no‑op value so callers do not
    need to guard every invocation with an availability check.
    """

    def is_available(self) -> bool:
        return False

    def upload_file(
        self, file_path: str, destination_path: str, /, **kwargs: Any
    ) -> Optional[Dict[str, Any]]:
        logger.warning("OneDrive not configured – upload skipped")
        return None

    def download_file(self, file_id: str, destination_path: str, /) -> Optional[str]:
        logger.warning("OneDrive not configured – download skipped")
        return None

    def list_files(
        self, folder_path: str = "/", /, **kwargs: Any
    ) -> List[Dict[str, Any]]:
        return []

    def delete_file(self, file_id: str, /) -> bool:
        logger.warning("OneDrive not configured – delete skipped")
        return False

    def get_share_link(self, file_id: str, /, **kwargs: Any) -> Optional[str]:
        logger.warning("OneDrive not configured – share-link skipped")
        return None
