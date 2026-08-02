# Backend API Inventory

## Overview
- **Framework**: Flask with SQLAlchemy ORM
- **Authentication**: JWT-based authentication with Bearer tokens
- **Database**: SQLite (development) / PostgreSQL (production)
- **CORS**: Configured via environment variable `CORS_ORIGINS`

## Authentication
All protected endpoints require `Authorization: Bearer <token>` header.

---

## User Routes (`/api/auth/*`, `/api/users/*`)

### POST `/api/auth/register`
- **Description**: Register a new user and return JWT token
- **Auth**: None
- **Request Body**:
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "user": {
      "id": 1,
      "username": "string",
      "email": "string",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    },
    "token": "jwt_token_string"
  }
  ```

### POST `/api/auth/login`
- **Description**: Authenticate user and return JWT token
- **Auth**: None
- **Request Body**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "user": {
      "id": 1,
      "username": "string",
      "email": "string",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    },
    "token": "jwt_token_string"
  }
  ```

### GET `/api/auth/me`
- **Description**: Get current authenticated user
- **Auth**: Required (Bearer token)
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "username": "string",
    "email": "string",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
  ```

### GET `/api/users`
- **Description**: Get all users
- **Auth**: None
- **Response**: `200 OK` - Array of user objects

### POST `/api/users`
- **Description**: Create a new user
- **Auth**: None
- **Request Body**: Same as register
- **Response**: `201 Created` - User object

### GET `/api/users/<user_id>`
- **Description**: Get specific user by ID
- **Auth**: None
- **Response**: `200 OK` - User object

### PUT `/api/users/<user_id>`
- **Description**: Update specific user
- **Auth**: None
- **Request Body**:
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string"
  }
  ```
- **Response**: `200 OK` - Updated user object

### DELETE `/api/users/<user_id>`
- **Description**: Delete specific user
- **Auth**: None
- **Response**: `204 No Content`

---

## Contract Routes (`/api/contracts/*`)

### GET `/api/contracts`
- **Description**: Get all contracts with optional filtering
- **Auth**: Required
- **Query Parameters**:
  - `user_id` (int): Filter by user ID (must match current user)
  - `upcoming_only` (bool): Get only contracts ending soon
  - `status` (string): Filter by status - `active`, `ending-soon`, `critical`, `expired`
- **Response**: `200 OK` - Array of contract objects with notification stats
  ```json
  [
    {
      "id": 1,
      "company_name": "string",
      "contract_name": "string",
      "start_date": "ISO8601",
      "end_date": "ISO8601",
      "renewal_date": "ISO8601",
      "notification_enabled": true,
      "notification_email": "string",
      "notification_mobile": false,
      "notes": "string",
      "contract_number": "string",
      "customer_id": 1,
      "contact_person_id": 1,
      "contract_date": "ISO8601",
      "status": "Active",
      "currency": "INR",
      "payment_terms": "string",
      "remarks": "string",
      "total_contract_value": 0.0,
      "contract_version": 1,
      "parent_contract_id": null,
      "previous_contract_id": null,
      "created_by_id": 1,
      "last_modified_by_id": 1,
      "created_at": "ISO8601",
      "updated_at": "ISO8601",
      "user_id": 1,
      "days_until_end": 30,
      "health_status": "Healthy",
      "next_reminder_date": "ISO8601",
      "total_reminders_sent": 0,
      "last_reminder_sent_at": "ISO8601",
      "last_reminder_type": "string",
      "last_reminder_message": "string"
    }
  ]
  ```

### POST `/api/contracts`
- **Description**: Create a new contract
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "company_name": "string",
    "contract_name": "string",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "renewal_date": "YYYY-MM-DD",
    "notification_enabled": true,
    "notification_email": "string",
    "notification_mobile": false,
    "notes": "string",
    "contract_number": "string",
    "customer_id": 1,
    "contact_person_id": 1,
    "contract_date": "YYYY-MM-DD",
    "status": "Active",
    "currency": "INR",
    "payment_terms": "string",
    "remarks": "string",
    "contract_version": 1,
    "parent_contract_id": null,
    "previous_contract_id": null,
    "line_items": [
      {
        "product": "string",
        "quantity": 1.0,
        "rate": 100.0,
        "remarks": "string"
      }
    ]
  }
  ```
- **Response**: `201 Created` - Contract object with notification stats

### GET `/api/contracts/<contract_id>`
- **Description**: Get specific contract by ID
- **Auth**: Required
- **Response**: `200 OK` - Contract object with notification stats

### PUT `/api/contracts/<contract_id>`
- **Description**: Update specific contract
- **Auth**: Required
- **Request Body**: Same as POST (partial updates allowed)
- **Response**: `200 OK` - Updated contract object

### DELETE `/api/contracts/<contract_id>`
- **Description**: Delete specific contract
- **Auth**: Required
- **Response**: `204 No Content`

### GET `/api/contracts/dashboard`
- **Description**: Get dashboard data with contract statistics
- **Auth**: Required
- **Query Parameters**:
  - `user_id` (int): Filter by user ID (must match current user)
- **Response**: `200 OK`
  ```json
  {
    "active_contracts": [],
    "ending_soon_contracts": [],
    "critical_contracts": [],
    "expired_contracts": [],
    "upcoming_renewals": [],
    "upcoming_expiries": [],
    "overdue_contracts": [],
    "total_contracts": 0,
    "active_count": 0,
    "ending_soon_count": 0,
    "critical_count": 0,
    "expired_count": 0,
    "total_reminders_sent": 0,
    "upcoming_count": 0,
    "overdue_count": 0
  }
  ```

---

## Notification Routes (`/api/notifications/*`)

### GET `/api/notifications`
- **Description**: Get notification history
- **Auth**: Required
- **Query Parameters**:
  - `contract_id` (int): Filter by contract ID
  - `limit` (int): Limit results (default: 100, max: 1000)
- **Response**: `200 OK` - Array of notification objects
  ```json
  [
    {
      "id": 1,
      "contract_id": 1,
      "notification_type": "email",
      "send_date": "ISO8601",
      "status": "sent",
      "message": "string"
    }
  ]
  ```

### POST `/api/notifications`
- **Description**: Create a new notification record
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "contract_id": 1,
    "notification_type": "email",
    "status": "pending",
    "message": "string"
  }
  ```
- **Response**: `201 Created` - Notification object

### POST `/api/notifications/send-test`
- **Description**: Send a test notification for a specific contract
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "contract_id": 1,
    "type": "email"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "string",
    "type": "email"
  }
  ```

### POST `/api/notifications/check-renewals`
- **Description**: Manually trigger contract end-date reminder process
- **Auth**: Required
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "results": {
      "emails_sent": 0,
      "push_notifications_sent": 0,
      "errors": []
    }
  }
  ```

### GET `/api/notifications/history/<contract_id>`
- **Description**: Get notification history for specific contract
- **Auth**: Required
- **Response**: `200 OK` - Array of notification objects

### PUT `/api/notifications/settings/<contract_id>`
- **Description**: Update notification settings for specific contract
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "notification_enabled": true,
    "notification_email": "string",
    "notification_mobile": false
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "string",
    "contract": {}
  }
  ```

### POST `/api/notifications/configure`
- **Description**: Configure global notification settings
- **Auth**: Required
- **Request Body**: Configuration object
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "string",
    "config": {}
  }
  ```

---

## Management Routes (`/api/customers/*`, `/api/contacts/*`, `/api/contracts/<id>/*`, `/api/reports/*`)

### GET `/api/customers`
- **Description**: List all customers for current user
- **Auth**: Required
- **Response**: `200 OK` - Array of customer objects
  ```json
  [
    {
      "id": 1,
      "name": "string",
      "customer_code": "string",
      "phone": "string",
      "email": "string",
      "address": "string",
      "created_at": "ISO8601",
      "updated_at": "ISO8601",
      "user_id": 1
    }
  ]
  ```

### POST `/api/customers`
- **Description**: Create a new customer
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "name": "string",
    "customer_code": "string",
    "phone": "string",
    "email": "string",
    "address": "string"
  }
  ```
- **Response**: `201 Created` - Customer object

### GET `/api/customers/<customer_id>`
- **Description**: Get specific customer by ID
- **Auth**: Required
- **Response**: `200 OK` - Customer object

### PUT `/api/customers/<customer_id>`
- **Description**: Update specific customer
- **Auth**: Required
- **Request Body**: Same as POST (partial updates allowed)
- **Response**: `200 OK` - Updated customer object

### GET `/api/customers/<customer_id>/contacts`
- **Description**: Get contacts for specific customer
- **Auth**: Required
- **Response**: `200 OK` - Array of contact objects
  ```json
  [
    {
      "id": 1,
      "customer_id": 1,
      "contact_name": "string",
      "contact_number": "string",
      "email": "string",
      "designation": "string",
      "created_at": "ISO8601",
      "updated_at": "ISO8601",
      "user_id": 1
    }
  ]
  ```

### POST `/api/customers/<customer_id>/contacts`
- **Description**: Create a new contact for customer
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "contact_name": "string",
    "contact_number": "string",
    "email": "string",
    "designation": "string"
  }
  ```
- **Response**: `201 Created` - Contact object

### GET `/api/contacts`
- **Description**: List all contacts for current user
- **Auth**: Required
- **Query Parameters**:
  - `customer_id` (int): Filter by customer ID
- **Response**: `200 OK` - Array of contact objects

### GET `/api/contracts/<contract_id>/line-items`
- **Description**: Get line items for specific contract
- **Auth**: Required
- **Response**: `200 OK` - Array of line item objects
  ```json
  [
    {
      "id": 1,
      "contract_id": 1,
      "product": "string",
      "quantity": 1.0,
      "rate": 100.0,
      "amount": 100.0,
      "remarks": "string",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ]
  ```

### POST `/api/contracts/<contract_id>/line-items`
- **Description**: Create a new line item for contract
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "product": "string",
    "quantity": 1.0,
    "rate": 100.0,
    "remarks": "string"
  }
  ```
- **Response**: `201 Created` - Line item object

### GET `/api/contracts/<contract_id>/documents`
- **Description**: Get documents for specific contract
- **Auth**: Required
- **Response**: `200 OK` - Array of document objects
  ```json
  [
    {
      "id": 1,
      "contract_id": 1,
      "file_name": "string",
      "stored_file_name": "string",
      "content_type": "string",
      "uploaded_at": "ISO8601",
      "uploaded_by_id": 1
    }
  ]
  ```

### POST `/api/contracts/<contract_id>/documents`
- **Description**: Upload a document for contract
- **Auth**: Required
- **Request**: `multipart/form-data` with `file` field
- **Response**: `201 Created` - Document object

### POST `/api/contracts/<contract_id>/renew`
- **Description**: Renew a contract (create new version)
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "company_name": "string",
    "contract_name": "string",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "renewal_date": "YYYY-MM-DD",
    "notification_enabled": true,
    "notification_email": "string",
    "notification_mobile": false,
    "notes": "string",
    "contract_number": "string",
    "customer_id": 1,
    "contact_person_id": 1,
    "contract_date": "YYYY-MM-DD",
    "currency": "INR",
    "payment_terms": "string",
    "remarks": "string"
  }
  ```
- **Response**: `201 Created` - Renewed contract with line items

### GET `/api/contracts/<contract_id>/renewal-history`
- **Description**: Get renewal history for contract
- **Auth**: Required
- **Response**: `200 OK` - Array of contract objects with line items and documents

### GET `/api/reports/<report_name>`
- **Description**: Generate various reports
- **Auth**: Required
- **Available Reports**:
  - `active-contracts`: All active contracts
  - `expiring-contracts`: Contracts expiring within 30 days
  - `expired-contracts`: All expired contracts
  - `customers`: Customers with their contracts
  - `contacts`: Contacts with their contracts
  - `line-items`: All line items across contracts
- **Response**: `200 OK` - Report data array

---

## Database Models

### User
- `id` (PK)
- `username` (unique)
- `email` (unique)
- `password_hash`
- `created_at`
- `updated_at`

### Customer
- `id` (PK)
- `name`
- `customer_code`
- `phone`
- `email`
- `address`
- `created_at`
- `updated_at`
- `user_id` (FK to User)

### ContactPerson
- `id` (PK)
- `customer_id` (FK to Customer)
- `contact_name`
- `contact_number`
- `email`
- `designation`
- `created_at`
- `updated_at`
- `user_id` (FK to User)

### Contract
- `id` (PK)
- `company_name`
- `contract_name`
- `start_date`
- `end_date`
- `renewal_date`
- `notification_enabled`
- `notification_email`
- `notification_mobile`
- `notes`
- `contract_number` (unique)
- `customer_id` (FK to Customer)
- `contact_person_id` (FK to ContactPerson)
- `contract_date`
- `status`
- `currency`
- `payment_terms`
- `remarks`
- `total_contract_value`
- `contract_version`
- `parent_contract_id` (FK to Contract)
- `previous_contract_id` (FK to Contract)
- `created_by_id` (FK to User)
- `last_modified_by_id` (FK to User)
- `created_at`
- `updated_at`
- `user_id` (FK to User)

### ContractLineItem
- `id` (PK)
- `contract_id` (FK to Contract)
- `product`
- `quantity`
- `rate`
- `amount`
- `remarks`
- `created_at`
- `updated_at`

### ContractDocument
- `id` (PK)
- `contract_id` (FK to Contract)
- `file_name`
- `stored_file_name`
- `file_path`
- `content_type`
- `uploaded_at`
- `uploaded_by_id` (FK to User)

### ContractRenewal
- `id` (PK)
- `original_contract_id` (FK to Contract)
- `parent_contract_id` (FK to Contract)
- `previous_contract_id` (FK to Contract)
- `new_contract_id` (FK to Contract)
- `created_at`
- `created_by_id` (FK to User)

### Notification
- `id` (PK)
- `contract_id` (FK to Contract)
- `notification_type`
- `send_date`
- `status`
- `message`

---

## Missing Endpoints (Need to be Created)

The following endpoints are missing from the backend and need to be created:

1. **Products Module**
   - GET `/api/products` - List all products
   - POST `/api/products` - Create product
   - GET `/api/products/<id>` - Get specific product
   - PUT `/api/products/<id>` - Update product
   - DELETE `/api/products/<id>` - Delete product
   - GET `/api/products/search` - Search products

2. **Purchase Orders Module**
   - GET `/api/purchase-orders` - List all POs
   - POST `/api/purchase-orders` - Create PO
   - GET `/api/purchase-orders/<id>` - Get specific PO
   - PUT `/api/purchase-orders/<id>` - Update PO
   - DELETE `/api/purchase-orders/<id>` - Delete PO

3. **Invoices Module**
   - GET `/api/invoices` - List all invoices
   - POST `/api/invoices` - Create invoice
   - GET `/api/invoices/<id>` - Get specific invoice
   - PUT `/api/invoices/<id>` - Update invoice
   - DELETE `/api/invoices/<id>` - Delete invoice

4. **SKU Generation**
   - POST `/api/contracts/generate-sku` - Generate unique SKU

5. **Global Search**
   - GET `/api/search` - Global search across all entities

6. **Document Download**
   - GET `/api/contracts/<contract_id>/documents/<document_id>` - Download specific document

7. **Document Delete**
   - DELETE `/api/contracts/<contract_id>/documents/<document_id>` - Delete specific document

8. **Contact Delete**
   - DELETE `/api/contacts/<contact_id>` - Delete specific contact

9. **Customer Delete**
   - DELETE `/api/customers/<customer_id>` - Delete specific customer

10. **Reports Export**
    - GET `/api/reports/<report_name>/export` - Export report as PDF/CSV/Excel
