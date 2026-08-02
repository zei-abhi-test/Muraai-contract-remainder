import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class MicrosoftConfig:
    """Configuration for Microsoft 365 / Azure AD integration.

    All fields are loaded from environment variables.  Every service has an
    ``enabled`` flag that defaults to ``True`` — when credentials are missing
    the provider factory will return a no‑op stub instead of raising an error.
    """

    # ── Azure AD app registration ──────────────────────────────────────
    tenant_id: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None

    # ── Per‑service feature flags ──────────────────────────────────────
    onedrive_enabled: bool = False
    outlook_enabled: bool = False
    teams_enabled: bool = False
    entra_enabled: bool = False

    # ── Graph API endpoint (override for sovereign clouds) ─────────────
    graph_endpoint: str = "https://graph.microsoft.com/v1.0"
    auth_endpoint: str = "https://login.microsoftonline.com"

    # ── Derived helpers ────────────────────────────────────────────────
    @property
    def has_credentials(self) -> bool:
        return bool(self.tenant_id and self.client_id and self.client_secret)

    @classmethod
    def from_env(cls) -> "MicrosoftConfig":
        tenant_id = os.getenv("AZURE_TENANT_ID")
        client_id = os.getenv("AZURE_CLIENT_ID")
        client_secret = os.getenv("AZURE_CLIENT_SECRET")

        has_creds = bool(tenant_id and client_id and client_secret)

        return cls(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
            onedrive_enabled=has_creds
            and os.getenv("ONEDRIVE_ENABLED", "true").lower() == "true",
            outlook_enabled=has_creds
            and os.getenv("OUTLOOK_ENABLED", "true").lower() == "true",
            teams_enabled=has_creds
            and os.getenv("TEAMS_ENABLED", "true").lower() == "true",
            entra_enabled=has_creds
            and os.getenv("ENTRA_ENABLED", "true").lower() == "true",
            graph_endpoint=os.getenv("GRAPH_API_ENDPOINT", "https://graph.microsoft.com/v1.0"),
            auth_endpoint=os.getenv(
                "AZURE_AUTH_ENDPOINT", "https://login.microsoftonline.com"
            ),
        )
