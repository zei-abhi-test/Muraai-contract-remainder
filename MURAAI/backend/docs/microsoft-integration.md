# Microsoft 365 Integration

Provider‑based abstraction for OneDrive, Outlook, Teams, and Entra ID.

## Architecture

```
src/services/microsoft/
├── __init__.py          # Public exports
├── config.py            # Environment‑variable configuration
├── interfaces.py        # Abstract base classes (ABCs)
├── graph_client.py      # Shared OAuth2 / Graph HTTP client
├── onedrive.py          # OneDrive provider + Null stub
├── outlook.py           # Outlook mail/calendar provider + Null stub
├── teams.py             # Teams provider + Null stub
├── entra.py             # Entra ID provider + Null stub
└── provider.py          # ProviderRegistry factory
```

Each service has two implementations:

| Service | Live provider | Null stub (returned when credentials missing) |
|---|---|---|
| **OneDrive** | `GraphOneDriveProvider` | `NullOneDriveProvider` |
| **Outlook** | `GraphOutlookProvider` | `NullOutlookProvider` |
| **Teams** | `GraphTeamsProvider` | `NullTeamsProvider` |
| **Entra ID** | `GraphEntraIDProvider` | `NullEntraIDProvider` |

Null stubs log a warning and return safe no‑op defaults — callers never need
`try`/`except` around optional Microsoft features.

## Required Environment Variables

### Azure AD App Registration

| Variable | Required | Default | Description |
|---|---|---|---|
| `AZURE_TENANT_ID` | **Yes** | — | Your Azure AD tenant (directory) ID |
| `AZURE_CLIENT_ID` | **Yes** | — | App registration Application (client) ID |
| `AZURE_CLIENT_SECRET` | **Yes** | — | App registration client secret / password |

The app registration must have the following **Microsoft Graph API permissions**
(applies to the **client credentials** flow — admin consent required):

- `Files.ReadWrite.All` — OneDrive
- `Mail.Send` — Outlook send‑mail
- `Calendars.ReadWrite` — Outlook calendar
- `Teamwork.Migrate.All` — Teams messaging
- `User.Read.All` — Entra ID user lookup
- `GroupMember.Read.All` — Entra ID group membership

### Per‑Service Feature Flags

| Variable | Required | Default | Description |
|---|---|---|---|
| `ONEDRIVE_ENABLED` | No | `true` | Set to `false` to disable OneDrive even when credentials exist |
| `OUTLOOK_ENABLED` | No | `true` | Set to `false` to disable Outlook |
| `TEAMS_ENABLED` | No | `true` | Set to `false` to disable Teams |
| `ENTRA_ENABLED` | No | `true` | Set to `false` to disable Entra ID |

### Advanced / Sovereign Cloud

| Variable | Required | Default | Description |
|---|---|---|---|
| `GRAPH_API_ENDPOINT` | No | `https://graph.microsoft.com/v1.0` | Override for national/sovereign clouds |
| `AZURE_AUTH_ENDPOINT` | No | `https://login.microsoftonline.com` | Override for national/sovereign clouds |

## Usage

```python
from src.services.microsoft import MicrosoftConfig, MicrosoftProviderRegistry

# 1. Load configuration from environment
config = MicrosoftConfig.from_env()

# 2. Create the registry (lazily initialises providers)
registry = MicrosoftProviderRegistry(config)

# 3. Use providers — safe even when credentials are missing
if registry.onedrive.is_available():
    result = registry.onedrive.upload_file("/tmp/report.pdf", "/Contracts/Report.pdf")
    if result:
        print("Uploaded:", result.get("id"))

if registry.outlook.is_available():
    registry.outlook.send_email(
        to=["finance@example.com"],
        subject="Invoice PAID – INV‑2024‑001",
        body="<h2>Invoice PAID</h2><p>Amount: $1,200.00</p>",
    )

if registry.teams.is_available():
    registry.teams.send_channel_message(
        team_id="00000000-0000-0000-0000-000000000000",
        channel_id="19:xxx@thread.tacv2",
        message="<h3>Contract approved</h3><p>ABC Corp contract was approved.</p>",
    )

if registry.entra.is_available():
    user = registry.entra.get_user("user@example.com")
    if user:
        print("Display name:", user.get("displayName"))
```

## Adding a New Provider

1. Add an abstract class in `interfaces.py`.
2. Create a live implementation (e.g. `my_provider.py`) using `GraphClient`.
3. Create a corresponding `Null` stub class.
4. Add an `enabled` field to `MicrosoftConfig`.
5. Wire the provider into `MicrosoftProviderRegistry`.

## Testing Without Credentials

When `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, or `AZURE_CLIENT_SECRET` are not
set in the environment, the registry returns Null stubs for all services.
No configuration changes are needed — every method accepts the same arguments
and logs a warning with full context.
