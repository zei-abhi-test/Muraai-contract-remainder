# Backend Audit Report
## Contract Management System

**Date:** July 12, 2026
**Auditor:** Cascade AI
**Scope:** Flask + SQLAlchemy + PostgreSQL Backend

---

## Executive Summary

The backend has a solid foundation with core entities (Customer, Contact, Contract, Product) but lacks several critical features required by the client:

1. **Missing Contract Type master** - No contract type classification
2. **No SKU architecture** - Product model lacks SKU field and uniqueness
3. **Incomplete line items** - Missing discount, tax, line_total calculations
4. **No approval workflow** - No approval tracking or state machine
5. **Limited renewal automation** - No automatic renewal processing
6. **Document storage** - Files stored locally, not OneDrive-ready
7. **No SSO architecture** - Only JWT authentication

---

## Database Models Analysis

### ✅ Existing Models

#### Customer
**File:** `src/models/contract.py`

**Fields:**
- id (PK)
- name
- customer_code
- phone
- email
- address
- created_at
- updated_at
- user_id (FK)

**Status:** ✅ COMPLETE
- All required fields present
- Foreign key to user for ownership
- Timestamps for tracking

#### ContactPerson
**File:** `src/models/contract.py`

**Fields:**
- id (PK)
- customer_id (FK to Customer)
- contact_name
- contact_number
- email
- designation
- created_at
- updated_at
- user_id (FK)

**Status:** ✅ COMPLETE
- Correct relationship to Customer
- All required fields present
- Ownership tracking

#### Contract
**File:** `src/models/contract.py`

**Fields:**
- id (PK)
- company_name
- contract_name
- start_date
- end_date
- renewal_date
- notification_enabled
- notification_email
- notification_mobile
- notes
- contract_number (UNIQUE)
- customer_id (FK to Customer)
- contact_person_id (FK to ContactPerson)
- contract_date
- status (string, default "Active")
- currency (default "INR")
- payment_terms
- remarks
- total_contract_value
- contract_version (default 1)
- parent_contract_id (FK to Contract)
- previous_contract_id (FK to Contract)
- created_by_id (FK to User)
- last_modified_by_id (FK to User)
- created_at
- updated_at
- user_id (FK to User)

**Status:** ⚠️ PARTIAL
- ❌ Missing: contract_type_id (FK to ContractType)
- ❌ Status is free-text string, not enum
- ❌ No lifecycle state machine
- ✅ Has version tracking
- ✅ Has renewal relationships
- ✅ Has audit trail (created_by, last_modified_by)

#### ContractLineItem
**File:** `src/models/contract.py`

**Fields:**
- id (PK)
- contract_id (FK to Contract)
- product (STRING, not FK)
- quantity
- rate
- amount (calculated: quantity × rate)
- remarks
- created_at
- updated_at

**Status:** ❌ INCOMPLETE
- ❌ product is string, should be product_id (FK to Product)
- ❌ Missing: sku
- ❌ Missing: product_name
- ❌ Missing: discount
- ❌ Missing: tax
- ❌ Missing: line_total
- ❌ Calculation is simple (quantity × rate), missing discount/tax logic
- ❌ No SKU tracking

#### Product
**File:** `src/models/contract.py`

**Fields:**
- id (PK)
- name
- code (UNIQUE)
- category
- rate
- status (default "active")
- created_at
- updated_at
- user_id (FK to User)

**Status:** ❌ INCOMPLETE
- ❌ Missing: sku (MANDATORY per client)
- ❌ Missing: description
- ❌ Missing: price (separate from rate?)
- ❌ code is unique but not formatted as SKU
- ❌ No SKU generation logic
- ❌ No SKU uniqueness constraint at DB level

#### ContractDocument
**File:** `src/models/contract.py`

**Fields:**
- id (PK)
- contract_id (FK to Contract)
- file_name
- stored_file_name
- file_path (local path)
- content_type
- uploaded_at
- uploaded_by_id (FK to User)

**Status:** ❌ NOT ONE-DRIVE READY
- ❌ Files stored locally (file_path)
- ❌ Missing: external_file_id
- ❌ Missing: external_url
- ❌ Missing: storage_provider
- ❌ Missing: file_size
- ❌ No storage abstraction layer

#### ContractRenewal
**File:** `src/models/contract.py`

**Fields:**
- id (PK)
- original_contract_id (FK to Contract)
- parent_contract_id (FK to Contract)
- previous_contract_id (FK to Contract)
- new_contract_id (FK to Contract)
- created_at
- created_by_id (FK to User)

**Status:** ⚠️ PARTIAL
- ✅ Has version tracking
- ❌ Missing: renewal_frequency
- ❌ Missing: renewal_start_date
- ❌ No automatic renewal processing
- ❌ No renewal notification trigger

#### Notification
**File:** `src/models/contract.py`

**Fields:**
- id (PK)
- contract_id (FK to Contract)
- notification_type ('email' or 'mobile')
- send_date
- status ('sent', 'failed', 'pending')
- message

**Status:** ⚠️ PARTIAL
- ✅ Basic notification tracking
- ❌ No approval notification support
- ❌ No renewal notification support

---

## ❌ Missing Models

### ContractType
**Required Fields:**
- id (PK)
- name
- description
- status

**Status:** ❌ DOES NOT EXIST
- Client specifically requested Contract Type functionality
- Contract should reference contract_type_id

### ContractApproval
**Required Fields:**
- id (PK)
- contract_id (FK to Contract)
- approver_id (FK to User)
- status
- comments
- submitted_at
- approved_at
- rejected_at

**Status:** ❌ DOES NOT EXIST
- No approval workflow tracking
- No approver assignment

---

## API Routes Analysis

### Management Routes (`src/routes/management.py`)

#### Customers
- `GET /customers` - ✅ List customers
- `POST /customers` - ✅ Create customer
- `GET /customers/<id>` - ✅ Get customer
- `PUT /customers/<id>` - ✅ Update customer
- `GET /customers/<id>/contacts` - ✅ Get customer contacts
- `POST /customers/<id>/contacts` - ✅ Create contact for customer

**Status:** ✅ COMPLETE

#### Contacts
- `GET /contacts` - ✅ List contacts (with customer_id filter)
- `GET /contacts/<id>` - ✅ Get contact
- `PUT /contacts/<id>` - ✅ Update contact
- `DELETE /contacts/<id>` - ✅ Delete contact

**Status:** ✅ COMPLETE

#### Products
- `GET /products` - ✅ List products
- `POST /products` - ✅ Create product
- `GET /products/<id>` - ✅ Get product
- `PUT /products/<id>` - ✅ Update product
- `DELETE /products/<id>` - ✅ Delete product

**Status:** ⚠️ PARTIAL
- ❌ No SKU generation endpoint
- ❌ No search by SKU
- ❌ No search by product code
- ❌ code field used but not SKU

#### Contracts
- `GET /contracts/<id>/line-items` - ✅ Get line items
- `POST /contracts/<id>/line-items` - ✅ Create line item
- `GET /contracts/<id>/documents` - ✅ Get documents
- `POST /contracts/<id>/documents` - ✅ Upload document
- `POST /contracts/<id>/renew` - ✅ Renew contract
- `GET /contracts/<id>/renewal-history` - ✅ Get renewal history

**Status:** ⚠️ PARTIAL
- ❌ Line items missing discount/tax fields
- ❌ Document upload stores locally
- ❌ No approval workflow endpoints

#### Reports
- `GET /reports/<report_name>` - ✅ Various reports

**Status:** ✅ COMPLETE

---

### Contract Routes (`src/routes/contract.py`)

#### Contracts
- `GET /contracts` - ✅ List contracts (with status filter)
- `POST /contracts` - ✅ Create contract
- `GET /contracts/<id>` - ✅ Get contract
- `PUT /contracts/<id>` - ✅ Update contract
- `DELETE /contracts/<id>` - ✅ Delete contract
- `GET /contracts/dashboard` - ✅ Dashboard data

**Status:** ⚠️ PARTIAL
- ❌ No contract_type_id in create/update
- ❌ Status is free-text, not validated
- ❌ No lifecycle state machine validation
- ❌ Line items missing discount/tax

#### Notifications
- `GET /notifications` - ✅ Get notifications
- `POST /notifications` - ✅ Create notification

**Status:** ✅ COMPLETE

---

## Critical Gaps Summary

### 1. SKU Architecture
**Current State:**
- Product has `code` field (unique string)
- No SKU generation logic
- No SKU format enforcement
- No SKU uniqueness at DB level (only code is unique)

**Required:**
- Add `sku` field to Product model
- Add UNIQUE constraint on sku
- Implement SKU generation: `SKU-{CATEGORY}-{COMPANY}-{YEAR}-{SEQUENCE}`
- Backend must generate SKU, not frontend
- Handle duplicate SKU errors

### 2. Contract Type Master
**Current State:**
- Does not exist

**Required:**
- Create ContractType model
- Add contract_type_id FK to Contract
- Create CRUD endpoints for ContractType
- Add ContractType dropdown to Create Contract wizard

### 3. Line Items Calculation
**Current State:**
- Simple calculation: amount = quantity × rate
- No discount
- No tax
- No line_total

**Required:**
- Add fields: discount, tax, line_total
- Implement formula:
  - base_amount = quantity × rate
  - discount_amount = base_amount × discount / 100
  - taxable_amount = base_amount - discount_amount
  - tax_amount = taxable_amount × tax / 100
  - line_total = taxable_amount + tax_amount
- Backend must verify calculations

### 4. Contract Lifecycle
**Current State:**
- Status is free-text string
- No state machine
- No transition validation
- No approval workflow

**Required:**
- Implement lifecycle states:
  - DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED → ACTIVE → RENEWAL_DUE → RENEWED → COMPLETED/EXPIRED
- Add ON_HOLD state
- Validate transitions (e.g., EXPIRED → ACTIVE not allowed)
- Create centralized lifecycle service

### 5. Approval Workflow
**Current State:**
- Does not exist

**Required:**
- Create ContractApproval model
- Implement approval endpoints
- Contract cannot become ACTIVE until approved
- Track approver, comments, timestamps

### 6. Renewal Automation
**Current State:**
- Manual renewal endpoint exists
- No automatic processing
- No configurable frequency

**Required:**
- Add renewal_frequency to Contract
- Implement automatic renewal trigger (1 month before end)
- Support frequencies: Monthly, Quarterly, Half-Yearly, Yearly, Custom
- Create renewal record (not overwrite)

### 7. Document Storage
**Current State:**
- Files stored locally
- No OneDrive integration

**Required:**
- Add metadata fields: external_file_id, external_url, storage_provider, file_size
- Create storage abstraction layer
- Prepare for OneDrive provider
- Do not store binary content in PostgreSQL

### 8. Contract Number Generation
**Current State:**
- ✅ Auto-generated: `MCR-{YEAR}-{USER_ID:03d}-{COUNT:05d}`
- ✅ Unique constraint

**Status:** ✅ CORRECT
- Format matches client requirement
- Backend generates, not frontend

---

## Frontend-Frontend API Compatibility

### Product Model Mismatch
**Backend returns:**
```json
{
  "id": 1,
  "name": "Product Name",
  "code": "PROD001",
  "category": "Category",
  "rate": 100.00,
  "status": "active",
  "created_at": "...",
  "updated_at": "...",
  "user_id": 1
}
```

**Frontend expects (from previous work):**
- Product selection in line items uses product name
- Auto-populates rate
- No SKU handling

**Issue:** Frontend not using product_id, using product name string

### Contract Status
**Backend:** Free-text string
**Frontend:** Hardcoded options (Active, Draft, Pending, Expired)

**Issue:** No validation, can set any status

### Line Items
**Backend:** product (string), quantity, rate, amount
**Frontend:** product (string), quantity, rate, remarks

**Issue:** Missing discount, tax, line_total in both

---

## Migration Requirements

### Required Migrations

1. **Add SKU to Product**
   - Add `sku` column (unique)
   - Add `description` column
   - Add `price` column (separate from rate?)
   - Create unique constraint on sku

2. **Create ContractType table**
   - Create table with id, name, description, status

3. **Add contract_type_id to Contract**
   - Add FK to ContractType

4. **Update ContractLineItem**
   - Add `product_id` FK to Product
   - Add `sku` column
   - Add `product_name` column
   - Add `discount` column
   - Add `tax` column
   - Add `line_total` column
   - Update calculation logic

5. **Create ContractApproval table**
   - Create table with approval tracking fields

6. **Update ContractDocument**
   - Add `external_file_id`
   - Add `external_url`
   - Add `storage_provider`
   - Add `file_size`

7. **Add renewal_frequency to Contract**
   - Add column for renewal frequency

8. **Create Contract lifecycle enum**
   - Convert status from string to enum
   - Or add validation

---

## Recommendations

### Immediate Actions (Phase 1)

1. **Fix Product Model**
   - Add SKU field with unique constraint
   - Implement SKU generation
   - Add description field
   - Update API to return SKU

2. **Fix ContractLineItem**
   - Add product_id FK
   - Add discount, tax, line_total
   - Implement proper calculation
   - Update API

3. **Create ContractType Master**
   - Create model
   - Create CRUD endpoints
   - Add to Contract model

### Medium Actions (Phase 2-4)

4. **Implement Contract Lifecycle**
   - Create state machine
   - Validate transitions
   - Update status handling

5. **Implement Approval Workflow**
   - Create ContractApproval model
   - Create approval endpoints
   - Integrate with lifecycle

6. **Fix Renewal Workflow**
   - Add renewal_frequency
   - Implement automatic processing
   - Add configurable triggers

### Long-term Actions (Phase 5-6)

7. **Prepare Document Storage**
   - Add metadata fields
   - Create storage abstraction
   - Prepare for OneDrive

8. **Prepare SSO**
   - Keep JWT functional
   - Design SSO architecture
   - Do not break existing auth

---

## Conclusion

The backend has a solid foundation but requires significant enhancements to meet client requirements. The most critical gaps are:

1. **SKU architecture** - Missing mandatory SKU field and generation
2. **Contract Type** - Missing master table
3. **Line items** - Missing discount/tax calculations
4. **Lifecycle** - No state machine or validation
5. **Approvals** - No approval workflow

All changes must be done via Alembic migrations. The frontend must be updated to match the new backend structure.

---

## Next Steps

1. Create migration for SKU field
2. Implement SKU generation logic
3. Create ContractType model and migration
4. Update ContractLineItem model and migration
5. Implement line item calculations
6. Create ContractApproval model
7. Implement lifecycle state machine
8. Update frontend to match new API structure
