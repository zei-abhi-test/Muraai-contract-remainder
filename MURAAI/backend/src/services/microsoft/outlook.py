from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.services.microsoft.graph_client import GraphClient
from src.services.microsoft.interfaces import OutlookProvider
from src.services.logging_config import get_structured_logger

logger = get_structured_logger(__name__)


class GraphOutlookProvider(OutlookProvider):
    """Outlook mail and calendar provider backed by Microsoft Graph."""

    def __init__(self, client: GraphClient) -> None:
        self._client = client

    def is_available(self) -> bool:
        return True

    def send_email(
        self,
        to: List[str],
        subject: str,
        body: str,
        /,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> bool:
        try:
            message = {
                "message": {
                    "subject": subject,
                    "body": {"contentType": "HTML", "content": body},
                    "toRecipients": [{"emailAddress": {"address": addr}} for addr in to],
                },
                "saveToSentItems": True,
            }
            if cc:
                message["message"]["ccRecipients"] = [
                    {"emailAddress": {"address": addr}} for addr in cc
                ]
            if bcc:
                message["message"]["bccRecipients"] = [
                    {"emailAddress": {"address": addr}} for addr in bcc
                ]
            if attachments:
                message["message"]["attachments"] = self._build_attachments(attachments)

            self._client.post("/me/sendMail", json=message)
            logger.info("Email sent via Outlook", context={"to": to, "subject": subject})
            return True
        except Exception as exc:
            logger.error("Outlook send failed", context={"error": str(exc), "to": to})
            return False

    def create_calendar_event(
        self,
        subject: str,
        start: str,
        end: str,
        /,
        attendees: Optional[List[str]] = None,
        body: Optional[str] = None,
        location: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        try:
            event: Dict[str, Any] = {
                "subject": subject,
                "start": {"dateTime": start, "timeZone": "UTC"},
                "end": {"dateTime": end, "timeZone": "UTC"},
            }
            if body:
                event["body"] = {"contentType": "HTML", "content": body}
            if location:
                event["location"] = {"displayName": location}
            if attendees:
                event["attendees"] = [
                    {"emailAddress": {"address": addr}, "type": "required"}
                    for addr in attendees
                ]

            result = self._client.post("/me/events", json=event)
            logger.info("Calendar event created", context={"subject": subject})
            return result
        except Exception as exc:
            logger.error(
                "Outlook calendar event failed", context={"error": str(exc)}
            )
            return None

    @staticmethod
    def _build_attachments(
        attachments: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        result = []
        for att in attachments:
            result.append(
                {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": att.get("name", "attachment"),
                    "contentBytes": att.get("contentBytes", ""),
                    "contentType": att.get("contentType", "application/octet-stream"),
                }
            )
        return result


class NullOutlookProvider(OutlookProvider):
    """Placeholder provider returned when Outlook credentials are missing."""

    def is_available(self) -> bool:
        return False

    def send_email(
        self,
        to: List[str],
        subject: str,
        body: str,
        /,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> bool:
        logger.warning(
            "Outlook not configured – email not sent",
            context={"to": to, "subject": subject},
        )
        return False

    def create_calendar_event(
        self,
        subject: str,
        start: str,
        end: str,
        /,
        attendees: Optional[List[str]] = None,
        body: Optional[str] = None,
        location: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        logger.warning("Outlook not configured – calendar event not created")
        return None
