"""Complete end-to-end seed script for Muraai CROP.

Creates a realistic business scenario: Acme Technologies (vendor) selling
Enterprise CRM License + Premium Support to Global Retail Ltd (customer).

Usage:
  python seed_complete.py

Credentials created:
  Email: admin@acmetech.com
  Password: Acme@2026!
"""

import os, sys, json, uuid
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))
os.environ["FLASK_ENV"] = "testing"
os.environ["AUTO_CREATE_TABLES"] = "false"

from src.main import app
from src.models.user import db as _db, User, Organization, UserPreference
from src.models.contract import (
    ActivityLog, ContactPerson, Contract, ContractApproval, ContractClause,
    ContractDocument, ContractEventLog, ContractLineItem, ContractRenewal,
    ContractType, Customer, Invoice, InvoiceLineItem, Notification, Product,
    PurchaseOrder, PurchaseOrderContract, SkuCounter,
)
from src.models.workflow import Workflow, WorkflowStage, WorkflowAssignment, WorkflowAssignmentStage
from src.models.calendar import CalendarEvent, Task
from src.models.automation import AutomationRule
from src.services.domain_event import dispatcher
from decimal import Decimal

TODAY = date.today()

with app.app_context():
    # ── Clean existing test data for this user (email-based) ──────────
    existing = User.query.filter_by(email="admin@acmetech.com").first()
    if existing:
        uid = existing.id
        print(f"Cleaning existing data for user {uid}...")
        InvoiceLineItem.query.filter(InvoiceLineItem.invoice_id.in_(
            _db.session.query(Invoice.id).filter(Invoice.user_id == uid)
        )).delete(synchronize_session=False)
        Invoice.query.filter_by(user_id=uid).delete()
        PurchaseOrderContract.query.filter(PurchaseOrderContract.purchase_order_id.in_(
            _db.session.query(PurchaseOrder.id).filter(PurchaseOrder.user_id == uid)
        )).delete(synchronize_session=False)
        PurchaseOrder.query.filter_by(user_id=uid).delete()
        ContractApproval.query.filter(ContractApproval.contract_id.in_(
            _db.session.query(Contract.id).filter(Contract.user_id == uid)
        )).delete(synchronize_session=False)
        ContractClause.query.filter(ContractClause.contract_id.in_(
            _db.session.query(Contract.id).filter(Contract.user_id == uid)
        )).delete(synchronize_session=False)
        ContractLineItem.query.filter(ContractLineItem.contract_id.in_(
            _db.session.query(Contract.id).filter(Contract.user_id == uid)
        )).delete(synchronize_session=False)
        ContractDocument.query.filter(ContractDocument.contract_id.in_(
            _db.session.query(Contract.id).filter(Contract.user_id == uid)
        )).delete(synchronize_session=False)
        ContractRenewal.query.filter_by(original_contract_id=Contract.id).filter(
            Contract.user_id == uid
        ).delete(synchronize_session=False)
        ActivityLog.query.filter_by(user_id=uid).delete()
        Notification.query.filter(Notification.contract_id.in_(
            _db.session.query(Contract.id).filter(Contract.user_id == uid)
        )).delete(synchronize_session=False)
        ContractEventLog.query.filter(
            (ContractEventLog.user_id == uid) |
            (ContractEventLog.aggregate_id.in_(
                _db.session.query(Contract.id).filter(Contract.user_id == uid)
            ))
        ).delete(synchronize_session=False)
        Contract.query.filter_by(user_id=uid).delete()
        ContactPerson.query.filter_by(user_id=uid).delete()
        Customer.query.filter_by(user_id=uid).delete()
        Product.query.filter_by(user_id=uid).delete()
        WorkflowAssignmentStage.query.filter(WorkflowAssignmentStage.assignment_id.in_(
            _db.session.query(WorkflowAssignment.id).filter(WorkflowAssignment.entity_type == "contract")
        )).delete(synchronize_session=False)
        WorkflowAssignment.query.filter_by(entity_type="contract").delete()
        CalendarEvent.query.filter_by(user_id=uid).delete()
        # Clean task-related tables before tasks
        from src.models.calendar import TaskHistory, TaskComment, TaskAttachment
        TaskHistory.query.filter(TaskHistory.task_id.in_(
            _db.session.query(Task.id).filter(Task.user_id == uid)
        )).delete(synchronize_session=False)
        TaskComment.query.filter(TaskComment.task_id.in_(
            _db.session.query(Task.id).filter(Task.user_id == uid)
        )).delete(synchronize_session=False)
        TaskAttachment.query.filter(TaskAttachment.task_id.in_(
            _db.session.query(Task.id).filter(Task.user_id == uid)
        )).delete(synchronize_session=False)
        Task.query.filter_by(user_id=uid).delete()
        UserPreference.query.filter_by(user_id=uid).delete()
        Organization.query.filter_by(user_id=uid).delete()
        AutomationRule.query.filter_by(created_by=uid).delete()
        SkuCounter.query.delete()
        UserPreference.query.filter_by(user_id=uid).delete()
        IntegrationConfig = None
        try:
            from src.models.user import IntegrationConfig as IC
            IntegrationConfig = IC
        except:
            pass
        if IntegrationConfig:
            IntegrationConfig.query.filter_by(user_id=uid).delete()
        from src.models.user import LoginHistory, RoleAssignment
        LoginHistory.query.filter_by(user_id=uid).delete()
        RoleAssignment.query.filter_by(user_id=uid).delete()
        _db.session.commit()

        # Also clean all tables with user_id foreign key
        for t in [UserPreference, Organization, LoginHistory, RoleAssignment]:
            t.query.filter_by(user_id=uid).delete()
        _db.session.commit()

        User.query.filter_by(id=uid).delete()
        _db.session.commit()
        print("  Done.\n")

    print("=" * 60)
    print("  MURAAI CROP — COMPLETE SEED")
    print("=" * 60)

    # ══════════════════════════════════════════════════════════════════
    # 1. USER — Acme Technologies admin
    # ══════════════════════════════════════════════════════════════════
    user = User(
        username="acme_admin",
        email="admin@acmetech.com",
        name="Ravi Kumar",
        phone="+91-9876543210",
        department="Contracts & Procurement",
        role="CONTRACT_MANAGER",
        status="active",
    )
    user.set_password("Acme@2026!")
    _db.session.add(user)
    _db.session.flush()
    print(f"\n[1] User created: {user.name} ({user.email}) — ID {user.id}")

    # ── Organization ────────────────────────────────────────────────
    org = Organization(
        user_id=user.id,
        company_name="Acme Technologies Pvt Ltd",
        address="42, Electronic City Phase 1, Bangalore, Karnataka 560100, India",
        default_currency="INR",
        timezone="Asia/Kolkata",
        fiscal_year="2026-2027",
    )
    _db.session.add(org)

    # ── User Preferences ────────────────────────────────────────────
    prefs = UserPreference(
        user_id=user.id,
        notification_email=True,
        notification_push=True,
        reminder_days=30,
        approval_notifications=True,
        default_renewal_period_days=365,
        default_payment_terms="Net 30",
        theme="light",
    )
    _db.session.add(prefs)

    # ── SkuCounter ──────────────────────────────────────────────────
    sku_counter = SkuCounter(prefix="CRM", next_value=1)
    _db.session.add(sku_counter)
    sku_counter2 = SkuCounter(prefix="SUP", next_value=1)
    _db.session.add(sku_counter2)
    _db.session.flush()

    # ══════════════════════════════════════════════════════════════════
    # 2. CONTRACT TYPE
    # ══════════════════════════════════════════════════════════════════
    contract_type = ContractType.query.filter_by(name="Annual Subscription").first()
    if not contract_type:
        contract_type = ContractType(
            name="Annual Subscription",
            description="Annual subscription contract with automatic renewal eligibility",
            status="active",
        )
        _db.session.add(contract_type)
        _db.session.flush()
    print(f"[2] Contract Type: {contract_type.name} (ID {contract_type.id})")

    # ══════════════════════════════════════════════════════════════════
    # 3. CUSTOMER
    # ══════════════════════════════════════════════════════════════════
    customer = Customer.query.filter_by(customer_code="GRL-001", user_id=user.id).first()
    if not customer:
        customer = Customer(
            name="Global Retail Ltd",
            customer_code="GRL-001",
            phone="+1-555-0199",
            email="accounts@globalretail.com",
            address="200 Park Avenue, New York, NY 10017, USA",
            user_id=user.id,
        )
        _db.session.add(customer)
        _db.session.flush()
    print(f"[3] Customer: {customer.name} (ID {customer.id})")

    # ══════════════════════════════════════════════════════════════════
    # 4. CONTACT PERSON
    # ══════════════════════════════════════════════════════════════════
    contact = ContactPerson(
        customer_id=customer.id,
        contact_name="John Smith",
        contact_number="+1-555-0200",
        email="john.smith@globalretail.com",
        designation="Head of Procurement",
        user_id=user.id,
    )
    _db.session.add(contact)
    _db.session.flush()
    print(f"[4] Contact: {contact.contact_name} ({contact.designation}) — ID {contact.id}")

    # ══════════════════════════════════════════════════════════════════
    # 5. PRODUCTS
    # ══════════════════════════════════════════════════════════════════
    product1 = Product.query.filter_by(sku="CRM-ENT-001").first()
    if not product1:
        product1 = Product(
            name="Enterprise CRM License",
            code="CRM-ENT",
            sku="CRM-ENT-001",
            category="Software License",
            rate=Decimal("250000.00"),
            price=Decimal("300000.00"),
            description="Enterprise-grade Customer Relationship Management software license. Includes full API access, dedicated support, and 99.9% SLA.",
            status="active",
            user_id=user.id,
        )
        _db.session.add(product1)

    product2 = Product.query.filter_by(sku="SUP-PREM-001").first()
    if not product2:
        product2 = Product(
            name="Premium Support",
            code="SUP-PREM",
            sku="SUP-PREM-001",
            category="Support Services",
            rate=Decimal("75000.00"),
            price=Decimal("90000.00"),
            description="Premium 24x7 technical support with 1-hour response time, quarterly business reviews, and dedicated account manager.",
            status="active",
            user_id=user.id,
        )
        _db.session.add(product2)
    _db.session.flush()
    print(f"[5] Products: {product1.name}, {product2.name}")

    # ══════════════════════════════════════════════════════════════════
    # 6. CONTRACT
    # ══════════════════════════════════════════════════════════════════
    contract = Contract(
        company_name=customer.name,
        contract_name="Enterprise CRM License & Support Agreement",
        start_date=TODAY,
        end_date=TODAY + timedelta(days=365),
        renewal_date=TODAY + timedelta(days=335),
        notification_enabled=True,
        notification_email="admin@acmetech.com",
        notification_mobile=False,
        notes="Annual subscription for Enterprise CRM License with Premium Support. Auto-renewal eligible.",
        contract_number="CNT-2026-0001",
        customer_id=customer.id,
        contact_person_id=contact.id,
        contract_type_id=contract_type.id,
        contract_date=TODAY,
        status="Active",
        currency="INR",
        payment_terms="Net 30",
        total_contract_value=Decimal("343750.00"),
        contract_version=1,
        created_by_id=user.id,
        last_modified_by_id=user.id,
        user_id=user.id,
        activated_at=datetime.utcnow(),
        activated_by_id=user.id,
        activated_notes="Contract activated by Ravi Kumar on signing",
    )
    _db.session.add(contract)
    _db.session.flush()
    print(f"[6] Contract: {contract.contract_name} (#{contract.contract_number}) ID {contract.id}")

    # ── Line Item 1: Enterprise CRM License ─────────────────────────
    li1 = ContractLineItem(
        contract_id=contract.id,
        product_id=product1.id,
        sku=product1.sku,
        product_name=product1.name,
        quantity=Decimal("1"),
        rate=Decimal("250000.00"),
        discount=Decimal("5"),
        tax=Decimal("18"),
        amount=Decimal("0"),
        line_total=Decimal("0"),
        remarks="Annual license fee for 500 users",
    )
    li1.calculate_amount()

    # ── Line Item 2: Premium Support ────────────────────────────────
    li2 = ContractLineItem(
        contract_id=contract.id,
        product_id=product2.id,
        sku=product2.sku,
        product_name=product2.name,
        quantity=Decimal("1"),
        rate=Decimal("75000.00"),
        discount=Decimal("0"),
        tax=Decimal("18"),
        amount=Decimal("0"),
        line_total=Decimal("0"),
        remarks="Annual premium support fee",
    )
    li2.calculate_amount()

    _db.session.add(li1)
    _db.session.add(li2)
    _db.session.flush()

    # Recalculate contract total from line items
    contract.total_contract_value = li1.line_total + li2.line_total

    print(f"     Line Item 1: {li1.product_name} x {li1.quantity} @ {li1.rate} = {li1.line_total}")
    print(f"     Line Item 2: {li2.product_name} x {li2.quantity} @ {li2.rate} = {li2.line_total}")
    print(f"     Total Contract Value: {contract.total_contract_value}")

    # ── Contract Clauses ────────────────────────────────────────────
    clauses_data = [
        {"clause_type": "term", "title": "Term and Termination",
         "content": "This Agreement shall commence on the Start Date and continue for a period of one (1) year. Either party may terminate this Agreement with 30 days written notice."},
        {"clause_type": "payment", "title": "Payment Terms",
         "content": "All fees are due within 30 days of invoice date. Late payments shall accrue interest at 1.5% per month."},
        {"clause_type": "sla", "title": "Service Level Agreement",
         "content": "Vendor shall maintain 99.9% uptime for the CRM platform. Support response time shall not exceed 4 hours for standard issues."},
        {"clause_type": "data", "title": "Data Protection",
         "content": "Both parties shall comply with applicable data protection laws. Customer data shall not be transferred outside the designated region without written consent."},
    ]
    for cd in clauses_data:
        cl = ContractClause(
            contract_id=contract.id,
            clause_type=cd["clause_type"],
            title=cd["title"],
            content=cd["content"],
            version=1,
            is_active=True,
        )
        _db.session.add(cl)
    _db.session.flush()
    print(f"     Clauses: {len(clauses_data)} added")

    # ── Contract Document ───────────────────────────────────────────
    doc = ContractDocument(
        contract_id=contract.id,
        file_name="Enterprise_CRM_Agreement_2026.pdf",
        stored_file_name=f"doc_{uuid.uuid4().hex[:12]}.pdf",
        file_path="/app/storage/documents/Enterprise_CRM_Agreement_2026.pdf",
        content_type="application/pdf",
        file_size=245760,
        file_type="pdf",
        category="contract_agreement",
        storage_provider="local",
        uploaded_by_id=user.id,
    )
    _db.session.add(doc)
    _db.session.flush()
    print(f"     Document: {doc.file_name}")

    # ── Workflow for approvals ─────────────────────────────────────
    workflow = Workflow.query.filter_by(name="Standard Contract Approval").first()
    if not workflow:
        workflow = Workflow(
            name="Standard Contract Approval",
            description="Single-stage approval for standard contracts",
            workflow_type="contract_approval",
            is_active=True,
        )
        _db.session.add(workflow)
        _db.session.flush()

    stage = WorkflowStage(
        workflow_id=workflow.id,
        name="Manager Approval",
        stage_order=1,
        role_required="CONTRACT_MANAGER",
    )
    _db.session.add(stage)
    _db.session.flush()

    # ── Workflow Assignment ─────────────────────────────────────────
    wf_assignment = WorkflowAssignment(
        workflow_id=workflow.id,
        entity_type="contract",
        entity_id=contract.id,
        current_stage_order=1,
        status="completed",
    )
    _db.session.add(wf_assignment)
    _db.session.flush()

    wf_stage_record = WorkflowAssignmentStage(
        assignment_id=wf_assignment.id,
        stage_id=stage.id,
        stage_order=1,
        role_required="CONTRACT_MANAGER",
        status="approved",
        approved_by=user.id,
        comments="Contract approved",
    )
    _db.session.add(wf_stage_record)
    _db.session.flush()

    # ══════════════════════════════════════════════════════════════════
    # 7. APPROVAL — Pending (for the approval workflow demo)
    # ══════════════════════════════════════════════════════════════════
    now = datetime.utcnow()
    approval = ContractApproval(
        contract_id=contract.id,
        approver_id=None,
        requested_by=user.id,
        status="Pending",
        comments=None,
        approval_level=1,
        workflow_assignment_id=wf_assignment.id,
        submitted_at=now - timedelta(hours=2),
        approved_at=None,
        rejected_at=None,
    )
    _db.session.add(approval)
    _db.session.flush()
    print(f"[7] Approval: Pending (ID {approval.id})")

    # ══════════════════════════════════════════════════════════════════
    # 8. PURCHASE ORDER — Draft (will transition through workflow)
    # ══════════════════════════════════════════════════════════════════
    # Use a unique PO number — generate one that doesn't collide
    _po_seq = 1
    while PurchaseOrder.query.filter_by(po_number=f"PO-2026-{_po_seq:06d}").first():
        _po_seq += 1
    po = PurchaseOrder(
        po_number=f"PO-2026-{_po_seq:06d}",
        po_date=TODAY,
        vendor="Acme Technologies Pvt Ltd",
        customer_id=customer.id,
        amount=contract.total_contract_value,
        status="Draft",
        issue_date=TODAY,
        expected_delivery=TODAY + timedelta(days=15),
        currency="INR",
        remarks="Purchase order for Enterprise CRM License & Support Agreement",
        user_id=user.id,
    )
    _db.session.add(po)
    _db.session.flush()

    # Link PO to contract
    po_contract_link = PurchaseOrderContract(
        purchase_order_id=po.id,
        contract_id=contract.id,
    )
    _db.session.add(po_contract_link)
    _db.session.flush()
    print(f"[8] Purchase Order: {po.po_number} (Draft, ID {po.id})")

    # ══════════════════════════════════════════════════════════════════
    # 9. INVOICE — DRAFT
    # ══════════════════════════════════════════════════════════════════
    _inv_seq = 1
    while Invoice.query.filter_by(invoice_number=f"INV-2026-{_inv_seq:06d}").first():
        _inv_seq += 1
    inv = Invoice(
        invoice_number=f"INV-2026-{_inv_seq:06d}",
        contract_id=contract.id,
        customer_id=customer.id,
        purchase_order_id=po.id,
        amount=li1.line_total,
        tax=li2.tax * li2.amount / 100,
        discount=li1.discount * li1.amount / 100,
        total=contract.total_contract_value,
        currency="INR",
        invoice_date=TODAY,
        due_date=TODAY + timedelta(days=30),
        status="DRAFT",
        remarks="Invoice for Enterprise CRM License & Support Agreement",
        created_by=user.id,
        user_id=user.id,
    )
    _db.session.add(inv)
    _db.session.flush()

    # Invoice line items
    inv_li1 = InvoiceLineItem(
        invoice_id=inv.id,
        product_id=product1.id,
        product_name=product1.name,
        sku=product1.sku,
        quantity=li1.quantity,
        rate=li1.rate,
        discount=li1.discount,
        tax=li1.tax,
        amount=li1.amount,
    )
    _db.session.add(inv_li1)

    inv_li2 = InvoiceLineItem(
        invoice_id=inv.id,
        product_id=product2.id,
        product_name=product2.name,
        sku=product2.sku,
        quantity=li2.quantity,
        rate=li2.rate,
        discount=li2.discount,
        tax=li2.tax,
        amount=li2.amount,
    )
    _db.session.add(inv_li2)
    _db.session.flush()
    print(f"[9] Invoice: {inv.invoice_number} (DRAFT, ID {inv.id})")

    # ══════════════════════════════════════════════════════════════════
    # 10. ACTIVITY LOG ENTRIES
    # ══════════════════════════════════════════════════════════════════
    activities = [
        ("contract_created", "Contract created: Enterprise CRM License & Support Agreement",
         f"Contract with {customer.name} was created by Ravi Kumar.", contract.id),
        ("contract_approved", "Contract approved: Enterprise CRM License & Support Agreement",
         "Contract was approved.", contract.id),
        ("contract_activated", "Contract activated: Enterprise CRM License & Support Agreement",
         "Contract was activated by Ravi Kumar.", contract.id),
        ("po_created", f"Purchase order created: {po.po_number}",
         f"PO {po.po_number} for {contract.total_contract_value} was created.", contract.id),
        ("invoice_created", f"Invoice created: {inv.invoice_number}",
         f"Invoice {inv.invoice_number} for {contract.total_contract_value} was created.", contract.id),
        ("customer_created", f"Customer created: {customer.name}",
         f"Customer {customer.name} was created.", None),
        ("contact_created", f"Contact created: {contact.contact_name}",
         f"Contact {contact.contact_name} was created.", None),
        ("product_added", f"Products added: {product1.name}, {product2.name}",
         "Products added to contract.", contract.id),
        ("document_uploaded", f"Document uploaded: {doc.file_name}",
         f"Document {doc.file_name} was uploaded.", contract.id),
        ("approval_requested", f"Approval requested for: {contract.contract_name}",
         f"Approval for contract {contract.contract_name} has been requested.", contract.id),
    ]
    for atype, title, desc, cid in activities:
        log = ActivityLog(
            user_id=user.id,
            contract_id=cid,
            activity_type=atype,
            title=title,
            description=desc,
            entity_type="contract" if cid else None,
            entity_id=cid,
        )
        _db.session.add(log)
    _db.session.flush()
    print(f"[10] Activity Log: {len(activities)} entries")

    # ══════════════════════════════════════════════════════════════════
    # 11. NOTIFICATIONS
    # ══════════════════════════════════════════════════════════════════
    notifications_data = [
        ("email", "sent", "Contract Enterprise CRM License & Support Agreement was approved."),
        ("email", "sent", "Contract Enterprise CRM License & Support Agreement has been activated."),
        ("email", "sent", f"Purchase Order {po.po_number} has been created and requires processing."),
        ("email", "sent", f"Invoice {inv.invoice_number} is ready for review."),
        ("email", "sent", f"Approval for contract {contract.contract_name} is pending."),
        ("email", "sent", f"Renewal for contract {contract.contract_name} is due in 30 days."),
    ]
    for ntype, status, msg in notifications_data:
        notif = Notification(
            contract_id=contract.id,
            notification_type=ntype,
            status=status,
            message=msg,
        )
        _db.session.add(notif)
    _db.session.flush()
    print(f"[11] Notifications: {len(notifications_data)} entries")

    # ══════════════════════════════════════════════════════════════════
    # 12. EVENT LOG
    # ══════════════════════════════════════════════════════════════════
    events = [
        ("contract.created", "contract"),
        ("approval.requested", "contract"),
        ("approval.granted", "contract"),
        ("contract.activated", "contract"),
        ("purchase_order.created", "contract"),
        ("invoice.created", "contract"),
    ]
    for i, (etype, agg_type) in enumerate(events):
        evt = ContractEventLog(
            event_id=str(uuid.uuid4()),
            event_type=etype,
            aggregate_type=agg_type,
            aggregate_id=contract.id,
            user_id=user.id,
            correlation_id=str(uuid.uuid4()),
            version=1,
            payload_json=json.dumps({"event": etype, "timestamp": datetime.utcnow().isoformat()}),
        )
        _db.session.add(evt)
    _db.session.flush()
    print(f"[12] Event Log: {len(events)} entries")

    # ══════════════════════════════════════════════════════════════════
    # 13. CALENDAR EVENTS
    # ══════════════════════════════════════════════════════════════════
    calendar_events = [
        CalendarEvent(
            user_id=user.id,
            title=f"Contract Ends: {contract.contract_name}",
            description=f"Contract {contract.contract_name} with {customer.name} ends.",
            event_type="contract_end",
            start=datetime.combine(contract.end_date, datetime.min.time()),
            end=datetime.combine(contract.end_date, datetime.min.time()),
            all_day=True,
            color="#ef4444",
            entity_type="contract",
            entity_id=contract.id,
        ),
        CalendarEvent(
            user_id=user.id,
            title=f"Renewal Due: {contract.contract_name}",
            description=f"Renewal for contract {contract.contract_name} is due.",
            event_type="renewal",
            start=datetime.combine(contract.renewal_date, datetime.min.time()),
            end=datetime.combine(contract.renewal_date, datetime.min.time()),
            all_day=True,
            color="#f59e0b",
            entity_type="contract",
            entity_id=contract.id,
        ),
    ]
    for ce in calendar_events:
        _db.session.add(ce)
    _db.session.flush()
    print(f"[13] Calendar Events: {len(calendar_events)} entries")

    # ══════════════════════════════════════════════════════════════════
    # 14. TASKS
    # ══════════════════════════════════════════════════════════════════
    tasks = [
        Task(
            user_id=user.id,
            title=f"Review and approve contract: {contract.contract_name}",
            description=f"Contract {contract.contract_name} with {customer.name} is pending approval.",
            due_date=TODAY + timedelta(days=7),
            priority="HIGH",
            status="IN_PROGRESS",
            assigned_to=user.id,
            assigned_by=user.id,
            related_module="contract",
            related_record_id=contract.id,
        ),
        Task(
            user_id=user.id,
            title=f"Prepare renewal for: {contract.contract_name}",
            description=f"Renewal for contract {contract.contract_name} is due on {contract.renewal_date}.",
            due_date=contract.renewal_date - timedelta(days=30),
            priority="MEDIUM",
            status="TODO",
            assigned_to=user.id,
            assigned_by=user.id,
            related_module="contract",
            related_record_id=contract.id,
        ),
    ]
    for t in tasks:
        _db.session.add(t)
    _db.session.flush()
    print(f"[14] Tasks: {len(tasks)} entries")

    # ── Automation Rules ────────────────────────────────────────────
    rule = AutomationRule.query.filter_by(name="Notify on Contract Created").first()
    if not rule:
        rule = AutomationRule(
            name="Notify on Contract Created",
        description="Send notification when a new contract is created",
        trigger_type="contract_created",
        trigger_config=json.dumps({}),
        conditions=json.dumps([]),
        actions=json.dumps([{"type": "create_notification", "config": {}}]),
        is_enabled=True,
        created_by=user.id,
    )
    _db.session.add(rule)

    # ══════════════════════════════════════════════════════════════════
    # COMMIT ALL
    # ══════════════════════════════════════════════════════════════════
    _db.session.commit()

    print("\n" + "=" * 60)
    print("  SEED COMPLETE")
    print("=" * 60)
    print(f"\n  Credentials:")
    print(f"    Email:    admin@acmetech.com")
    print(f"    Password: Acme@2026!")
    print(f"\n  Summary:")
    print(f"    User:            {user.name} (ID {user.id})")
    print(f"    Customer:        {customer.name} (ID {customer.id})")
    print(f"    Contact:         {contact.contact_name} (ID {contact.id})")
    print(f"    Products:        {product1.name}, {product2.name}")
    print(f"    Contract Type:   {contract_type.name}")
    print(f"    Contract:        {contract.contract_name} (#{contract.contract_number})")
    print(f"    Line Items:      2 (total: {contract.total_contract_value})")
    print(f"    Clauses:         {len(clauses_data)}")
    print(f"    Documents:       1")
    print(f"    Approval:        Pending (ID {approval.id})")
    print(f"    Purchase Order:  {po.po_number} (Draft)")
    print(f"    Invoice:         {inv.invoice_number} (DRAFT)")
    print(f"    Activity Log:    {len(activities)} entries")
    print(f"    Notifications:   {len(notifications_data)}")
    print(f"    Event Log:       {len(events)} entries")
    print(f"    Calendar Events: {len(calendar_events)}")
    print(f"    Tasks:           {len(tasks)}")
    print(f"    Automation Rule: 1")
    print()
