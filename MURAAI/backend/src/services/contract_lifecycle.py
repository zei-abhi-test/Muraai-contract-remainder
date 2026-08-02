"""Centralized contract lifecycle rules.

The backend is the sole authority for contract status transitions. The
frontend must never invent its own transition rules - it only renders the
`allowed_actions` list this module computes for a given contract.
"""

# Canonical statuses (must match Contract.status string values exactly).
DRAFT = "Draft"
SUBMITTED = "Submitted"
PENDING_APPROVAL = "Pending Approval"
APPROVED = "Approved"
ACTIVE = "Active"
ON_HOLD = "On Hold"
RENEWAL_DUE = "Renewal Due"
RENEWED = "Renewed"
COMPLETED = "Completed"
EXPIRED = "Expired"
REJECTED = "Rejected"

ALL_STATUSES = [
    DRAFT,
    SUBMITTED,
    PENDING_APPROVAL,
    APPROVED,
    ACTIVE,
    ON_HOLD,
    RENEWAL_DUE,
    RENEWED,
    COMPLETED,
    EXPIRED,
    REJECTED,
]

# Purchase Order statuses
PO_DRAFT = "Draft"
PO_SUBMITTED = "Submitted"
PO_APPROVED = "Approved"
PO_CANCELLED = "Cancelled"
PO_COMPLETED = "Completed"
PO_MARK_RECEIVED = "Mark Received"

PO_ALL_STATUSES = [
    PO_DRAFT,
    PO_SUBMITTED,
    PO_APPROVED,
    PO_CANCELLED,
    PO_COMPLETED,
    PO_MARK_RECEIVED,
]

PO_ACTIONS = {
    "po_submit": ({PO_DRAFT}, PO_SUBMITTED),
    "po_approve": ({PO_SUBMITTED}, PO_APPROVED),
    "po_cancel": ({PO_DRAFT, PO_SUBMITTED}, PO_CANCELLED),
    "po_mark_received": ({PO_APPROVED}, PO_COMPLETED),
}

# action_name -> (allowed_source_statuses, target_status)
_ACTIONS = {
    "submit": ({DRAFT}, PENDING_APPROVAL),
    "revert_to_draft": ({REJECTED}, DRAFT),
    "cancel_approval": ({PENDING_APPROVAL}, DRAFT),
    "approve": ({PENDING_APPROVAL}, APPROVED),
    "reject": ({PENDING_APPROVAL}, REJECTED),
    "activate": ({APPROVED}, ACTIVE),
    "hold": ({ACTIVE}, ON_HOLD),
    "resume": ({ON_HOLD}, ACTIVE),
    "complete": ({ACTIVE, ON_HOLD}, COMPLETED),
    "mark_renewal_due": ({ACTIVE}, RENEWAL_DUE),
    "renew": ({ACTIVE, ON_HOLD, RENEWAL_DUE}, RENEWED),
    "expire": ({ACTIVE, ON_HOLD, RENEWAL_DUE, APPROVED}, EXPIRED),
}

# Actions that are always available regardless of lifecycle status.
_ALWAYS_AVAILABLE = {"view"}

# "edit" is available for any status that still permits changes; ACTIVE
# contracts get a restricted edit (enforced in the route layer, not here).
_EDITABLE_STATUSES = {DRAFT, REJECTED, ACTIVE, ON_HOLD, APPROVED, PENDING_APPROVAL}


class LifecycleError(Exception):
    """Raised when a requested action is not valid for the contract's
    current status. Routes should catch this and return 409."""

    def __init__(self, message, status_code=409):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def allowed_actions(status):
    """Return the list of action names valid from the given status."""
    actions = list(_ALWAYS_AVAILABLE)
    if status in _EDITABLE_STATUSES:
        actions.append("edit")
    for action, (sources, _target) in _ACTIONS.items():
        if status in sources:
            actions.append(action)
    return actions


def can_perform(status, action):
    if action in _ALWAYS_AVAILABLE:
        return True
    if action == "edit":
        return status in _EDITABLE_STATUSES
    sources = _ACTIONS.get(action, (set(), None))[0]
    return status in sources


def target_status(action):
    if action not in _ACTIONS:
        raise LifecycleError(f"Unknown contract action '{action}'.", status_code=422)
    return _ACTIONS[action][1]


def po_allowed_actions(status):
    actions = ["view", "edit"]
    for action, (sources, _target) in PO_ACTIONS.items():
        if status in sources:
            actions.append(action)
    return actions


def po_can_perform(status, action):
    if action in ("view", "edit"):
        return True
    sources = PO_ACTIONS.get(action, (set(), None))[0]
    return status in sources


def po_target_status(action):
    if action not in PO_ACTIONS:
        raise LifecycleError(f"Unknown PO action '{action}'.", status_code=422)
    return PO_ACTIONS[action][1]


def po_apply_transition(po, action):
    current = po.status or PO_DRAFT
    if not po_can_perform(current, action):
        raise LifecycleError(
            f"Cannot perform '{action}' on a PO in '{current}' status."
        )
    po.status = po_target_status(action)
    return po.status


def apply_transition(contract, action):
    """Validate and apply a lifecycle action to `contract.status` in-place.

    Raises LifecycleError (caught by the route layer -> HTTP 409) if the
    action is not valid from the contract's current status.
    """
    current = contract.status or DRAFT
    if not can_perform(current, action):
        raise LifecycleError(
            f"Cannot perform '{action}' on a contract in '{current}' status."
        )
    contract.status = target_status(action)
    return contract.status
