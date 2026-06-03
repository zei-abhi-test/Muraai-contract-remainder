from flask import Blueprint, jsonify, request
from datetime import datetime, date
from src.models.contract import Contract, Notification, db
from src.services.auth import token_required
from src.services.validators import ContractCreate, ContractUpdate, NotificationCreate
from src.services.logging_config import get_structured_logger
from pydantic import ValidationError

contract_bp = Blueprint("contract", __name__)
logger = get_structured_logger(__name__)


def handle_validation_error(error: ValidationError):
    """Convert Pydantic validation errors to JSON response."""
    errors = {}
    for err in error.errors():
        field = ".".join(str(x) for x in err["loc"])
        errors[field] = err["msg"]
    return jsonify({"error": "Validation error", "details": errors}), 400


def get_owned_contract(contract_id: int, user_id: int):
    """Return a contract only when it belongs to the authenticated user."""
    return Contract.query.filter_by(id=contract_id, user_id=user_id).first()


@contract_bp.route("/contracts", methods=["GET"])
@token_required
def get_contracts(current_user):
    """Get all contracts with optional filtering"""
    try:
        user_id = request.args.get("user_id", type=int)
        upcoming_only = request.args.get("upcoming_only", "false").lower() == "true"

        if user_id and user_id != current_user.id:
            logger.warning(
                "Cross-user contract query blocked",
                context={"requested_user_id": user_id, "authenticated_user_id": current_user.id},
            )
            return jsonify({"error": "Forbidden"}), 403

        query = Contract.query.filter_by(user_id=current_user.id)

        if upcoming_only:
            # Get contracts ending in the next 30 days.
            from datetime import timedelta

            today = date.today()
            thirty_days_from_now = date.today() + timedelta(days=30)
            query = query.filter(
                Contract.end_date >= today, Contract.end_date <= thirty_days_from_now
            )

        contracts = query.order_by(Contract.end_date.asc()).all()
        logger.info(
            "Contracts retrieved",
            context={
                "contract_count": len(contracts),
                "user_id": current_user.id,
                "upcoming_only": upcoming_only,
            },
        )
        return jsonify([contract.to_dict() for contract in contracts]), 200
    except Exception as e:
        logger.error(
            "Failed to retrieve contracts", context={"error": str(e), "user_id": current_user.id}
        )
        return jsonify({"error": str(e)}), 500


@contract_bp.route("/contracts", methods=["POST"])
@token_required
def create_contract(current_user):
    """Create a new contract"""
    try:
        data = request.get_json() or {}

        # Validate request data
        validated_data = ContractCreate(**data)
        if validated_data.user_id and validated_data.user_id != current_user.id:
            return jsonify({"error": "Cannot create contracts for another user"}), 403

        contract = Contract(
            company_name=validated_data.company_name,
            contract_name=validated_data.contract_name,
            start_date=validated_data.start_date,
            end_date=validated_data.end_date,
            renewal_date=validated_data.renewal_date,
            notification_enabled=validated_data.notification_enabled,
            notification_email=validated_data.notification_email,
            notification_mobile=validated_data.notification_mobile,
            notes=validated_data.notes,
            user_id=current_user.id,
        )

        db.session.add(contract)
        db.session.commit()

        logger.info(
            "Contract created successfully",
            context={
                "contract_id": contract.id,
                "contract_name": contract.contract_name,
                "company_name": contract.company_name,
                "user_id": contract.user_id,
                "end_date": str(contract.end_date),
                "renewal_date": str(contract.renewal_date),
            },
        )
        return jsonify(contract.to_dict()), 201

    except ValidationError as e:
        logger.error("Contract creation validation error", context={"errors": str(e)})
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        logger.error(
            "Failed to create contract",
            context={"error": str(e), "exception_type": type(e).__name__},
        )
        return jsonify({"error": "Failed to create contract", "details": str(e)}), 400


@contract_bp.route("/contracts/<int:contract_id>", methods=["GET"])
@token_required
def get_contract(current_user, contract_id):
    """Get a specific contract by ID"""
    try:
        if contract_id <= 0:
            return jsonify({"error": "Invalid contract_id"}), 400

        contract = get_owned_contract(contract_id, current_user.id)
        if not contract:
            return jsonify({"error": "Contract not found"}), 404

        return jsonify(contract.to_dict()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contract_bp.route("/contracts/<int:contract_id>", methods=["PUT"])
@token_required
def update_contract(current_user, contract_id):
    """Update a specific contract"""
    try:
        if contract_id <= 0:
            return jsonify({"error": "Invalid contract_id"}), 400

        contract = get_owned_contract(contract_id, current_user.id)
        if not contract:
            return jsonify({"error": "Contract not found"}), 404

        data = request.get_json() or {}

        # Validate request data
        validated_data = ContractUpdate(**data)
        candidate_start_date = validated_data.start_date or contract.start_date
        candidate_end_date = validated_data.end_date or contract.end_date
        if candidate_end_date <= candidate_start_date:
            return jsonify({"error": "end_date must be after start_date"}), 400

        # Update fields if provided
        if validated_data.company_name is not None:
            contract.company_name = validated_data.company_name
        if validated_data.contract_name is not None:
            contract.contract_name = validated_data.contract_name
        if validated_data.start_date is not None:
            contract.start_date = validated_data.start_date
        if validated_data.end_date is not None:
            contract.end_date = validated_data.end_date
        if validated_data.renewal_date is not None:
            contract.renewal_date = validated_data.renewal_date
        if validated_data.notification_enabled is not None:
            contract.notification_enabled = validated_data.notification_enabled
        if validated_data.notification_email is not None:
            contract.notification_email = validated_data.notification_email
        if validated_data.notification_mobile is not None:
            contract.notification_mobile = validated_data.notification_mobile
        if validated_data.notes is not None:
            contract.notes = validated_data.notes

        contract.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(contract.to_dict()), 200

    except ValidationError as e:
        db.session.rollback()
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to update contract", "details": str(e)}), 400


@contract_bp.route("/contracts/<int:contract_id>", methods=["DELETE"])
@token_required
def delete_contract(current_user, contract_id):
    """Delete a specific contract"""
    try:
        if contract_id <= 0:
            return jsonify({"error": "Invalid contract_id"}), 400

        contract = get_owned_contract(contract_id, current_user.id)
        if not contract:
            return jsonify({"error": "Contract not found"}), 404

        # Delete associated notifications
        Notification.query.filter_by(contract_id=contract_id).delete()

        db.session.delete(contract)
        db.session.commit()
        return "", 204
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to delete contract", "details": str(e)}), 400


@contract_bp.route("/contracts/dashboard", methods=["GET"])
@token_required
def get_dashboard_data(current_user):
    """Get dashboard data including upcoming end dates and statistics."""
    try:
        user_id = request.args.get("user_id", type=int)

        if user_id and user_id != current_user.id:
            return jsonify({"error": "Forbidden"}), 403

        query = Contract.query.filter_by(user_id=current_user.id)

        # Get upcoming contract end dates (next 30 days).
        from datetime import timedelta

        today = date.today()
        thirty_days_from_now = today + timedelta(days=30)

        upcoming_contracts = (
            query.filter(Contract.end_date >= today, Contract.end_date <= thirty_days_from_now)
            .order_by(Contract.end_date.asc())
            .all()
        )

        # Get expired contracts.
        overdue_contracts = query.filter(Contract.end_date < today).all()

        # Get total contracts
        total_contracts = query.count()

        return (
            jsonify(
                {
                    "upcoming_renewals": [contract.to_dict() for contract in upcoming_contracts],
                    "upcoming_expiries": [contract.to_dict() for contract in upcoming_contracts],
                    "overdue_contracts": [contract.to_dict() for contract in overdue_contracts],
                    "expired_contracts": [contract.to_dict() for contract in overdue_contracts],
                    "total_contracts": total_contracts,
                    "upcoming_count": len(upcoming_contracts),
                    "overdue_count": len(overdue_contracts),
                }
            ),
            200,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contract_bp.route("/notifications", methods=["GET"])
@token_required
def get_notifications(current_user):
    """Get notification history"""
    try:
        contract_id = request.args.get("contract_id", type=int)
        limit = request.args.get("limit", default=100, type=int)

        if limit <= 0 or limit > 1000:
            limit = 100

        query = Notification.query.join(Contract).filter(Contract.user_id == current_user.id)
        if contract_id:
            if contract_id <= 0:
                return jsonify({"error": "Invalid contract_id"}), 400
            if not get_owned_contract(contract_id, current_user.id):
                return jsonify({"error": "Contract not found"}), 404
            query = query.filter(Notification.contract_id == contract_id)

        notifications = query.order_by(Notification.send_date.desc()).limit(limit).all()
        return jsonify([notification.to_dict() for notification in notifications]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contract_bp.route("/notifications", methods=["POST"])
@token_required
def create_notification(current_user):
    """Create a new notification record"""
    try:
        data = request.get_json() or {}

        # Validate request data
        validated_data = NotificationCreate(**data)

        # Check if contract exists
        contract = get_owned_contract(validated_data.contract_id, current_user.id)
        if not contract:
            return jsonify({"error": "Contract not found"}), 404

        notification = Notification(
            contract_id=validated_data.contract_id,
            notification_type=validated_data.notification_type.value,
            status=validated_data.status.value,
            message=validated_data.message,
        )

        db.session.add(notification)
        db.session.commit()
        return jsonify(notification.to_dict()), 201

    except ValidationError as e:
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create notification", "details": str(e)}), 400
