from __future__ import annotations

import time
from typing import Any, Dict, Optional

import requests

from src.services.microsoft.config import MicrosoftConfig
from src.services.logging_config import get_structured_logger

logger = get_structured_logger(__name__)


class GraphClient:
    """Shared HTTP client for Microsoft Graph API.

    Handles OAuth2 client‑credentials token acquisition and automatic
    token refresh.
    """

    def __init__(self, config: MicrosoftConfig) -> None:
        self._config = config
        self._token: Optional[str] = None
        self._token_expires_at: float = 0.0

    # ── Public helpers ──────────────────────────────────────────────────

    def get(
        self, path: str, *, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send an authenticated GET to the Graph API.

        *path* is relative to the configured *graph_endpoint* (e.g. ``/users``).
        """
        url = f"{self._config.graph_endpoint}{path}"
        token = self._ensure_token()
        logger.debug("Graph GET", context={"url": url})
        resp = requests.get(url, headers=self._auth_headers(token), params=params, timeout=30)
        return self._handle(resp)

    def post(
        self, path: str, *, json: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send an authenticated POST to the Graph API."""
        url = f"{self._config.graph_endpoint}{path}"
        token = self._ensure_token()
        logger.debug("Graph POST", context={"url": url})
        resp = requests.post(url, headers=self._auth_headers(token), json=json, timeout=30)
        return self._handle(resp)

    def delete(self, path: str) -> Dict[str, Any]:
        """Send an authenticated DELETE to the Graph API."""
        url = f"{self._config.graph_endpoint}{path}"
        token = self._ensure_token()
        logger.debug("Graph DELETE", context={"url": url})
        resp = requests.delete(url, headers=self._auth_headers(token), timeout=30)
        return self._handle(resp)

    def put(
        self, path: str, *, json: Optional[Dict[str, Any]] = None, data: Any = None
    ) -> Dict[str, Any]:
        """Send an authenticated PUT to the Graph API.

        Supports ``json`` (dict → JSON body) and ``data`` (raw bytes for
        file uploads).
        """
        url = f"{self._config.graph_endpoint}{path}"
        token = self._ensure_token()
        headers = self._auth_headers(token)
        if data is not None:
            headers.pop("Content-Type", None)  # let requests set it for multipart
        logger.debug("Graph PUT", context={"url": url})
        resp = requests.put(
            url, headers=headers, json=json, data=data, timeout=60
        )
        return self._handle(resp)

    # ── Token management ───────────────────────────────────────────────

    def _ensure_token(self) -> str:
        if self._token and time.time() < self._token_expires_at - 60:
            return self._token
        self._token, self._token_expires_at = self._acquire_token()
        return self._token

    def _acquire_token(self) -> tuple[str, float]:
        cfg = self._config
        url = f"{cfg.auth_endpoint}/{cfg.tenant_id}/oauth2/v2.0/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": cfg.client_id,
            "client_secret": cfg.client_secret,
            "scope": "https://graph.microsoft.com/.default",
        }
        logger.info("Acquiring Graph API token", context={"tenant": cfg.tenant_id})
        resp = requests.post(url, data=payload, timeout=30)
        resp.raise_for_status()
        body = resp.json()
        token: str = body["access_token"]
        expires_in: int = body.get("expires_in", 3600)
        return token, time.time() + expires_in

    # ── Internals ──────────────────────────────────────────────────────

    @staticmethod
    def _auth_headers(token: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    @staticmethod
    def _handle(resp: requests.Response) -> Dict[str, Any]:
        if resp.status_code >= 400:
            detail = resp.text[:500]
            logger.error(
                "Graph API error",
                context={
                    "status": resp.status_code,
                    "detail": detail,
                    "url": resp.request.url if resp.request else None,
                },
            )
            resp.raise_for_status()
        return resp.json() if resp.content else {}
