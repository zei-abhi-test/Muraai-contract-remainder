from src.routes.contracts.crud import contract_crud_bp
from src.routes.contracts.dashboard import contract_dashboard_bp
from src.routes.contracts.lifecycle import contract_lifecycle_routes_bp
from src.routes.contracts.notifications import contract_notifications_bp
from src.routes.contracts.renewals import contract_renewals_bp
from src.routes.contracts.sub_entities import contract_sub_entities_bp

contract_blueprints = [
    contract_crud_bp,
    contract_lifecycle_routes_bp,
    contract_renewals_bp,
    contract_sub_entities_bp,
    contract_notifications_bp,
    contract_dashboard_bp,
]

__all__ = [
    "contract_crud_bp",
    "contract_lifecycle_routes_bp",
    "contract_renewals_bp",
    "contract_sub_entities_bp",
    "contract_notifications_bp",
    "contract_dashboard_bp",
    "contract_blueprints",
]
