from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class OneDriveProvider(ABC):
    """Provider for OneDrive file storage operations."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True when the provider has valid credentials."""

    @abstractmethod
    def upload_file(
        self, file_path: str, destination_path: str, /, **kwargs: Any
    ) -> Optional[Dict[str, Any]]:
        """Upload a local file to OneDrive.

        Returns metadata dict (id, name, webUrl, etc.) or None on failure.
        """

    @abstractmethod
    def download_file(self, file_id: str, destination_path: str, /) -> Optional[str]:
        """Download a file from OneDrive to a local path.

        Returns the local path or None on failure.
        """

    @abstractmethod
    def list_files(
        self, folder_path: str = "/", /, **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """List files and folders under *folder_path*."""

    @abstractmethod
    def delete_file(self, file_id: str, /) -> bool:
        """Delete a file by its OneDrive id.  Returns True on success."""

    @abstractmethod
    def get_share_link(self, file_id: str, /, **kwargs: Any) -> Optional[str]:
        """Create a sharing link for the file.  Returns the URL or None."""


class OutlookProvider(ABC):
    """Provider for Outlook mail and calendar operations."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True when the provider has valid credentials."""

    @abstractmethod
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
        """Send an email via Microsoft Graph.

        Returns True when the message was accepted for delivery.
        """

    @abstractmethod
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
        """Create a calendar event.

        Returns event metadata or None on failure.
        """


class TeamsProvider(ABC):
    """Provider for Microsoft Teams channel operations."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True when the provider has valid credentials."""

    @abstractmethod
    def send_channel_message(
        self, team_id: str, channel_id: str, message: str, /
    ) -> Optional[Dict[str, Any]]:
        """Post a message to a Teams channel.

        Returns message metadata or None on failure.
        """

    @abstractmethod
    def list_channels(
        self, team_id: str, /
    ) -> List[Dict[str, Any]]:
        """List channels in a team."""

    @abstractmethod
    def list_teams(self) -> List[Dict[str, Any]]:
        """List Microsoft Teams the current user/app has access to."""


class EntraIDProvider(ABC):
    """Provider for Microsoft Entra ID (Azure AD) identity operations."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True when the provider has valid credentials."""

    @abstractmethod
    def get_user(self, user_id: str, /) -> Optional[Dict[str, Any]]:
        """Look up a user by id or userPrincipalName."""

    @abstractmethod
    def list_users(
        self, *, filter_expr: Optional[str] = None, top: int = 100
    ) -> List[Dict[str, Any]]:
        """List users in the directory."""

    @abstractmethod
    def get_group_members(
        self, group_id: str, /
    ) -> List[Dict[str, Any]]:
        """List members of a security / Microsoft 365 group."""

    @abstractmethod
    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate and decode an access token.

        Returns the token payload (claims) or None if invalid / expired.
        """
