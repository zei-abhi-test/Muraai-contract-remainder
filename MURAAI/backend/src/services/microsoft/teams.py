from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.services.microsoft.graph_client import GraphClient
from src.services.microsoft.interfaces import TeamsProvider
from src.services.logging_config import get_structured_logger

logger = get_structured_logger(__name__)


class GraphTeamsProvider(TeamsProvider):
    """Microsoft Teams provider backed by the Graph API."""

    def __init__(self, client: GraphClient) -> None:
        self._client = client

    def is_available(self) -> bool:
        return True

    def send_channel_message(
        self, team_id: str, channel_id: str, message: str, /
    ) -> Optional[Dict[str, Any]]:
        try:
            body = {"body": {"contentType": "html", "content": message}}
            result = self._client.post(
                f"/teams/{team_id}/channels/{channel_id}/messages", json=body
            )
            logger.info(
                "Teams message sent",
                context={"team_id": team_id, "channel_id": channel_id},
            )
            return result
        except Exception as exc:
            logger.error("Teams send failed", context={"error": str(exc)})
            return None

    def list_channels(self, team_id: str, /) -> List[Dict[str, Any]]:
        try:
            resp = self._client.get(f"/teams/{team_id}/channels")
            return resp.get("value", [])
        except Exception as exc:
            logger.error("Teams list-channels failed", context={"error": str(exc)})
            return []

    def list_teams(self) -> List[Dict[str, Any]]:
        try:
            resp = self._client.get("/me/joinedTeams")
            return resp.get("value", [])
        except Exception as exc:
            logger.error("Teams list failed", context={"error": str(exc)})
            return []


class NullTeamsProvider(TeamsProvider):
    """Placeholder provider returned when Teams credentials are missing."""

    def is_available(self) -> bool:
        return False

    def send_channel_message(
        self, team_id: str, channel_id: str, message: str, /
    ) -> Optional[Dict[str, Any]]:
        logger.warning("Teams not configured – message not sent")
        return None

    def list_channels(self, team_id: str, /) -> List[Dict[str, Any]]:
        return []

    def list_teams(self) -> List[Dict[str, Any]]:
        return []
