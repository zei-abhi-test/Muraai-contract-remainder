# Contract Aggregate — Sequence Diagrams

**Status:** Draft (Sprint 1)
**Date:** 2026-07-20
**Purpose:** 8 sequence diagrams covering all contract lifecycle flows. Each diagram shows commands, aggregate validation, events, policies, and downstream effects.

---

## Diagram 1: Contract Creation → Activation

The happy path: user creates a draft contract, fills in details, then activates it.

```mermaid
sequenceDiagram
    actor User
    participant API as Contract API
    participant AR as Contract Aggregate
    participant DB as Database
    participant EventLog as Event Store
    participant Timeline as Timeline Projection
    participant Policy as RenewalDetectionPolicy

    User->>API: POST /api/contracts {vendor, dates, line_items}
    API->>AR: CreateContract command
    AR->>AR: Validate: vendor exists, dates valid, line_items > 0
    AR->>DB: INSERT contract (status=DRAFT)
    AR->>DB: INSERT line_items
    AR->>EventLog: Append contract.drafted
    AR-->>API: Contract created (id, status=DRAFT)
    API-->>User: 201 Created {id, status, allowed_actions}

    Note over User,API: User reviews draft, uploads documents, adds clauses

    User->>API: POST /api/contracts/{id}/activate
    API->>AR: ActivateContract command
    AR->>AR: Validate: status=DRAFT, end_date > now, min 1 line_item
    AR->>DB: UPDATE contract (status=ACTIVE, activated_at)
    AR->>EventLog: Append contract.activated
    AR-->>API: Contract activated
    API-->>User: 200 OK {status=ACTIVE, health=Healthy}

    Note over EventLog,Policy: Async processing
    EventLog->>Timeline: Update timeline
    EventLog->>Policy: contract.activated
    Policy->>Policy: Is end_date within renewal window?
    alt renewal window open
      Policy->>AR: CreateRenewal command (auto)
      AR->>EventLog: Append renewal.created
    end
```

---

## Diagram 2: Contract Amendment (During ACTIVE)

User modifies an active contract. The system snapshots the previous state and emits an amendment event.

```mermaid
sequenceDiagram
    actor User
    participant API as Contract API
    participant AR as Contract Aggregate
    participant DB as Database
    participant EventLog as Event Store
    participant Timeline as Timeline Projection
    participant Notif as Notifications

    User->>API: PUT /api/contracts/{id} {end_date, line_items}
    API->>AR: UpdateContract command
    AR->>AR: Validate: status=ACTIVE, field mutability
    AR->>AR: Detect: restricted fields changed (end_date, line_items)
    AR->>DB: INSERT contract_version_history (snapshot of pre-amendment state)
    AR->>DB: UPDATE contract (end_date, contract_version+1)
    AR->>DB: UPDATE line_items
    AR->>EventLog: Append contract.amended
    AR-->>API: Amendment applied
    API-->>User: 200 OK {contract_version: 3}
    EventLog->>Timeline: Update timeline
    EventLog->>Notif: contract.amended
    Notif->>Notif: Notify contract owner of amendment
```

---

## Diagram 3: Contract Termination

User terminates an active contract. System validates reason, records termination, and cancels pending renewals.

```mermaid
sequenceDiagram
    actor User
    participant API as Contract API
    participant AR as Contract Aggregate
    participant DB as Database
    participant EventLog as Event Store
    participant Renewal as Renewal Aggregate
    participant Timeline as Timeline Projection
    participant Notif as Notifications

    User->>API: POST /api/contracts/{id}/terminate {reason, date}
    API->>AR: TerminateContract command
    AR->>AR: Validate: status=ACTIVE, termination_reason provided
    AR->>DB: UPDATE contract (status=TERMINATED, terminated_at, reason)
    AR->>EventLog: Append contract.terminated
    AR-->>API: Contract terminated
    API-->>User: 200 OK {status=TERMINATED}

    Note over EventLog,Renewal: Async processing
    EventLog->>Renewal: contract.terminated
    Renewal->>Renewal: Find active renewals for contract
    alt has pending renewals
      Renewal->>DB: UPDATE renewals (status=CANCELLED)
      Renewal->>EventLog: Append renewal.cancelled
    end
    EventLog->>Timeline: Update timeline
    EventLog->>Notif: contract.terminated
    Notif->>Notif: Notify contract owner
```

---

## Diagram 4: Contract Expiry (Scheduler-Detected)

The daily scheduler checks all ACTIVE contracts whose end_date has passed, marks them as expired.

```mermaid
sequenceDiagram
    participant Sched as Daily Scheduler
    participant AR as Contract Aggregate
    participant DB as Database
    participant Health as HealthService
    participant EventLog as Event Store
    participant Timeline as Timeline Projection
    participant Notif as Notifications
    participant Policy as RenewalDetectionPolicy

    Sched->>DB: SELECT * FROM contract WHERE status='ACTIVE' AND end_date < NOW()
    DB-->>Sched: [contract_1, contract_2, ...]

    loop for each expired contract
      Sched->>AR: ExpireContract command
      AR->>AR: Validate: status=ACTIVE, end_date passed
      AR->>DB: UPDATE contract (status=EXPIRED)
      AR->>EventLog: Append contract.expired
      AR-->>Sched: Expired

      EventLog->>Timeline: Update timeline
      EventLog->>Notif: contract.expired
      EventLog->>Health: contract.expired
      Health->>Health: Recompute health (now "Expired")
      Health->>EventLog: Append contract.health.changed
    end

    Sched->>DB: SELECT * FROM contract WHERE status='ACTIVE' AND renewal_window_open(NOW(), end_date)
    DB-->>Sched: [contract_3, ...]

    loop for each renewal-window contract
      Sched->>EventLog: Append contract.renewal_window_opened
      EventLog->>Policy: contract.renewal_window_opened
      Policy->>Policy: Check if renewal already exists for this year
      alt no renewal exists
        Policy->>AR: CreateRenewal command
        AR->>EventLog: Append renewal.created
      end
    end
```

---

## Diagram 5: Contract Archival

User archives an expired or terminated contract. System sets retention and prevents any further modifications.

```mermaid
sequenceDiagram
    actor User
    participant API as Contract API
    participant AR as Contract Aggregate
    participant DB as Database
    participant EventLog as Event Store
    participant Timeline as Timeline Projection

    User->>API: POST /api/contracts/{id}/archive {retention_until}
    API->>AR: ArchiveContract command
    AR->>AR: Validate: status in (EXPIRED, TERMINATED), retention_until > now
    AR->>DB: UPDATE contract (status=ARCHIVED, archived_at, archived_by, retention_until)
    AR->>EventLog: Append contract.archived
    AR-->>API: Contract archived
    API-->>User: 200 OK {status=ARCHIVED}

    EventLog->>Timeline: Update timeline
```

---

## Diagram 6: Inconsistency Detection → Resolution

System detects a data integrity violation (e.g., end_date before start_date after an update). Contract enters INCONSISTENT state. Admin resolves it.

```mermaid
sequenceDiagram
    actor User
    actor Admin
    participant API as Contract API
    participant AR as Contract Aggregate
    participant DB as Database
    participant EventLog as Event Store
    participant Timeline as Timeline Projection
    participant Notif as Notifications
    participant Health as HealthService

    User->>API: PUT /api/contracts/{id} {end_date: 2020-01-01}
    API->>AR: UpdateContract command
    AR->>AR: Validate dates -> FAIL: end_date before start_date
    AR->>DB: UPDATE contract (status=INCONSISTENT)
    AR->>DB: INSERT inconsistent_fields log
    AR->>EventLog: Append contract.marked_inconsistent
    AR-->>API: 200 OK {status=INCONSISTENT, warning: "end_date invalid"}
    API-->>User: 200 OK {status=INCONSISTENT, allowed_actions: ["resolve", "edit"]}

    EventLog->>Timeline: Update timeline
    EventLog->>Notif: contract.marked_inconsistent
    Notif->>Notif: Notify contract owner + admin
    EventLog->>Health: contract.marked_inconsistent
    Health->>EventLog: Append contract.health.changed (status=Inconsistent)

    Admin->>API: POST /api/contracts/{id}/resolve {corrections}
    API->>AR: ResolveInconsistency command
    AR->>AR: Validate: status=INCONSISTENT, corrections fix all issues
    AR->>DB: UPDATE contract (status=ACTIVE, end_date=2028-12-31)
    AR->>DB: INSERT resolution record
    AR->>EventLog: Append contract.resolved
    AR-->>API: Contract resolved
    API-->>Admin: 200 OK {status=ACTIVE}
```

---

## Diagram 7: Contract → Renewal (Window Opens → Renewal Created)

The full cross-aggregate flow from contract renewal window detection through renewal completion and contract update.

```mermaid
sequenceDiagram
    participant Sched as Daily Scheduler
    participant Contract as Contract Aggregate
    participant Renewal as Renewal Aggregate
    participant DB as Database
    participant EventLog as Event Store
    participant Policy as RenewalDetectionPolicy
    participant Timeline as Timeline Projection
    participant PO as PO Aggregate
    participant Invoice as Invoice Aggregate

    Sched->>Contract: contract.renewal_window_opened
    Contract->>EventLog: Append contract.renewal_window_opened
    EventLog->>Policy: contract.renewal_window_opened
    Policy->>Policy: Check: renewal exists for this contract+year?
    alt no existing renewal
      Policy->>Renewal: CreateRenewal command {contract_id, year}
      Renewal->>Renewal: Validate: contract exists, year > last renewal
      Renewal->>DB: INSERT renewal
      Renewal->>EventLog: Append renewal.created

      Note over Renewal,PO: Renewal lifecycle (simplified)
      Renewal->>EventLog: Append renewal.quote.received
      Renewal->>EventLog: Append renewal.budget.passed
      Renewal->>EventLog: Append renewal.legal.approved
      Renewal->>EventLog: Append renewal.business.approved

      Renewal->>PO: GeneratePO command
      PO->>DB: INSERT purchase_order
      PO->>EventLog: Append po.created
      PO->>EventLog: Append po.sent

      Renewal->>Invoice: RecordInvoice command
      Invoice->>DB: INSERT invoice
      Invoice->>EventLog: Append invoice.received
      Invoice->>EventLog: Append invoice.matched
      Invoice->>EventLog: Append invoice.payment.done

      Renewal->>Renewal: CompleteRenewal command
      Renewal->>DB: UPDATE renewal (status=completed)
      Renewal->>EventLog: Append renewal.completed
      Renewal->>Contract: contract.renewal_count.incremented
      Contract->>DB: UPDATE contract (renewal_count+1)
      Contract->>EventLog: Append contract.renewal_count.incremented
    end
```

---

## Diagram 8: Contract Deletion (Soft Delete)

User deletes a contract. System validates it's in DRAFT or EXPIRED status, soft-deletes it, and updates search index.

```mermaid
sequenceDiagram
    actor User
    participant API as Contract API
    participant AR as Contract Aggregate
    participant DB as Database
    participant EventLog as Event Store
    participant Timeline as Timeline Projection
    participant Search as Search Index

    User->>API: DELETE /api/contracts/{id}?reason=Duplicate
    API->>AR: DeleteContract command {reason}
    AR->>AR: Validate: status in (DRAFT, EXPIRED)
    AR->>DB: UPDATE contract (is_deleted=TRUE, deleted_at, deleted_by, deletion_reason)
    AR->>DB: UPDATE line_items (is_deleted=TRUE)
    AR->>DB: UPDATE documents (is_deleted=TRUE)
    AR->>DB: UPDATE clauses (is_deleted=TRUE)
    AR->>EventLog: Append contract.deleted
    AR-->>API: Contract soft-deleted
    API-->>User: 200 OK {is_deleted: true}

    EventLog->>Timeline: Update timeline
    EventLog->>Search: contract.deleted
    Search->>Search: Remove from search index
```
