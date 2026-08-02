from __future__ import annotations

from src.services.microsoft.config import MicrosoftConfig
from src.services.microsoft.entra import EntraIDProvider, GraphEntraIDProvider, NullEntraIDProvider
from src.services.microsoft.graph_client import GraphClient
from src.services.microsoft.onedrive import GraphOneDriveProvider, NullOneDriveProvider, OneDriveProvider
from src.services.microsoft.outlook import GraphOutlookProvider, NullOutlookProvider, OutlookProvider
from src.services.microsoft.teams import GraphTeamsProvider, NullTeamsProvider, TeamsProvider
from src.services.logging_config import get_structured_logger

logger = get_structured_logger(__name__)


class MicrosoftProviderRegistry:
    """Factory / registry for all Microsoft 365 service providers.

    Usage::

        config = MicrosoftConfig.from_env()
        registry = MicrosoftProviderRegistry(config)

        if registry.onedrive.is_available():
            registry.onedrive.upload_file("/tmp/report.pdf", "/Contracts/report.pdf")

        if registry.outlook.is_available():
            registry.outlook.send_email(
                to=["user@example.com"],
                subject="Contract Approved",
                body="<h1>Approved</h1>",
            )

    When credentials are missing or a service is explicitly disabled, the
    registry returns a **Null** provider that logs warnings and returns
    safe no‑op defaults — no ``None`` checks required.
    """

    def __init__(self, config: MicrosoftConfig) -> None:
        self._config = config
        self._client: GraphClient | None = None
        self._onedrive: OneDriveProvider | None = None
        self._outlook: OutlookProvider | None = None
        self._teams: TeamsProvider | None = None
        self._entra: EntraIDProvider | None = None

    # ── Properties ─────────────────────────────────────────────────────

    @property
    def onedrive(self) -> OneDriveProvider:
        if self._onedrive is None:
            self._onedrive = self._build(GraphOneDriveProvider, NullOneDriveProvider, "onedrive")
        return self._onedrive

    @property
    def outlook(self) -> OutlookProvider:
        if self._outlook is None:
            self._outlook = self._build(GraphOutlookProvider, NullOutlookProvider, "outlook")
        return self._outlook

    @property
    def teams(self) -> TeamsProvider:
        if self._teams is None:
            self._teams = self._build(GraphTeamsProvider, NullTeamsProvider, "teams")
        return self._teams

    @property
    def entra(self) -> EntraIDProvider:
        if self._entra is None:
            self._entra = self._build(GraphEntraIDProvider, NullEntraIDProvider, "entra")
        return self._entra

    # ── Internals ──────────────────────────────────────────────────────

    def _ensure_client(self) -> GraphClient:
        if self._client is None:
            self._client = GraphClient(self._config)
        return self._client

    def _build(self, live_cls: type, null_cls: type, service_name: str) -> object:
        enabled = getattr(self._config, f"{service_name}_enabled", False)
        if enabled and self._config.has_credentials:
            logger.info(
                "Microsoft provider initialised",
                context={"service": service_name},
            )
            return live_cls(self._ensure_client())
        logger.info(
            "Microsoft provider unavailable – using null stub",
            context={"service": service_name, "has_creds": self._config.has_credentials},
        )
        return null_cls()
