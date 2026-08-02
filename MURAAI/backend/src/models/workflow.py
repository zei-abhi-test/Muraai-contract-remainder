from datetime import datetime
from src.models.user import db


class Workflow(db.Model):
    __tablename__ = "workflow"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    workflow_type = db.Column(
        db.String(50), nullable=False,
        default="contract_approval",
    )
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stages = db.relationship(
        "WorkflowStage", backref="workflow", lazy="joined",
        order_by="WorkflowStage.stage_order",
        cascade="all, delete-orphan",
    )
    rules = db.relationship(
        "WorkflowRule", backref="workflow", lazy="joined",
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "workflow_type": self.workflow_type,
            "is_active": self.is_active,
            "stages": [s.to_dict() for s in self.stages],
            "rules": [r.to_dict() for r in self.rules],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class WorkflowStage(db.Model):
    __tablename__ = "workflow_stage"

    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(db.Integer, db.ForeignKey("workflow.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    stage_order = db.Column(db.Integer, nullable=False)
    role_required = db.Column(db.String(30), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "name": self.name,
            "stage_order": self.stage_order,
            "role_required": self.role_required,
        }


class WorkflowRule(db.Model):
    __tablename__ = "workflow_rule"

    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(db.Integer, db.ForeignKey("workflow.id"), nullable=False)
    field = db.Column(db.String(50), nullable=False)
    operator = db.Column(db.String(20), nullable=False)
    value = db.Column(db.String(200), nullable=False)
    priority = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "field": self.field,
            "operator": self.operator,
            "value": self.value,
            "priority": self.priority,
        }


class WorkflowAssignment(db.Model):
    __tablename__ = "workflow_assignment"

    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(db.Integer, db.ForeignKey("workflow.id"), nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=False)
    current_stage_order = db.Column(db.Integer, default=1)
    status = db.Column(db.String(20), default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workflow = db.relationship("Workflow", backref="assignments", lazy="joined")
    stage_records = db.relationship(
        "WorkflowAssignmentStage", backref="assignment", lazy="joined",
        order_by="WorkflowAssignmentStage.stage_order",
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        stages = sorted(self.stage_records, key=lambda s: s.stage_order)
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "workflow_name": self.workflow.name if self.workflow else None,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "current_stage_order": self.current_stage_order,
            "status": self.status,
            "stages": [s.to_dict() for s in stages],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class WorkflowAssignmentStage(db.Model):
    __tablename__ = "workflow_assignment_stage"

    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey("workflow_assignment.id"), nullable=False)
    stage_id = db.Column(db.Integer, db.ForeignKey("workflow_stage.id"), nullable=False)
    stage_order = db.Column(db.Integer, nullable=False)
    role_required = db.Column(db.String(30), nullable=False)
    status = db.Column(db.String(20), default="pending")
    approved_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    comments = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stage = db.relationship("WorkflowStage", lazy="joined")

    def to_dict(self):
        return {
            "id": self.id,
            "assignment_id": self.assignment_id,
            "stage_id": self.stage_id,
            "stage_name": self.stage.name if self.stage else None,
            "stage_order": self.stage_order,
            "role_required": self.role_required,
            "status": self.status,
            "approved_by": self.approved_by,
            "comments": self.comments,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
