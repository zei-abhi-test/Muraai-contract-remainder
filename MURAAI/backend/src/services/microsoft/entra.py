from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.services.microsoft.graph_client import GraphClient
from src.services.microsoft.interfaces import EntraIDProvider
from src.services.logging_config import get_structured_logger

logger = get_structured_logger(__name__)


class GraphEntraIDProvider(EntraIDProvider):
    """Microsoft Entra ID provider backed by Microsoft Graph."""

    def __init__(self, client: GraphClient) -> None:
        self._client = client

    def is_available(self) -> bool:
        return True

    def get_user(self, user_id: str, /) -> Optional[Dict[str, Any]]:
        try:
            return self._client.get(f"/users/{user_id}")
        except Exception as exc:
            logger.error("EntraID get-user failed", context={"error": str(exc), "user_id": user_id})
            return None

    def list_users(
        self, *, filter_expr: Optional[str] = None, top: int = 100
    ) -> List[Dict[str, Any]]:
        try:
            params: Dict[str, Any] = {"$top": top}
            if filter_expr:
                params["$filter"] = filter_expr
            resp = self._client.get("/users", params=params)
            return resp.get("value", [])
        except Exception as exc:
            logger.error("EntraID list-users failed", context={"error": str(exc)})
            return []

    def get_group_members(self, group_id: str, /) -> List[Dict[str, Any]]:
        try:
            resp = self._client.get(f"/groups/{group_id}/members")
            return resp.get("value", [])
        except Exception as exc:
            logger.error("EntraID group-members failed", context={"error": str(exc)})
            return []

    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            import jwt as pyjwt
            from jwt import PyJWKClient

            jwks_url = (
                f"https://login.microsoftonline.com/"
                f"{self._client._config.tenant_id}/discovery/v2.0/keys"
            )
            jwks_client = PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = pyjwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self._client._config.client_id,
                options={"verify_exp": True},
            )
            return payload
        except Exception as exc:
            logger.error("Token validation failed", context={"error": str(exc)})
            return None


class NullEntraIDProvider(EntraIDProvider):
    """Placeholder provider returned when Entra ID credentials are missing."""

    def is_available(self) -> bool:
        return False

    def get_user(self, user_id: str, /) -> Optional[Dict[str, Any]]:
        logger.warning("Entra ID not configured – user lookup skipped")
        return None

    def list_users(
        self, *, filter_expr: Optional[str] = None, top: int = 100
    ) -> List[Dict[str, Any]]:
        return []

    def get_group_members(self, group_id: str, /) -> List[Dict[str, Any]]:
        return []

    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        logger.warning("Entra ID not configured – token validation skipped")
        return None
