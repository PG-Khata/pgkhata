# Settings Data

## Rent Plans

| Field | Value |
|-------|-------|
| Plan ID | 1006 |
| Plan Name | Standard Single Room Plan |
| Monthly Rent | Rs. 10,000 |
| Security Deposit | Rs. 15,000 |
| Due Day | 5 (of each month) |
| Late Fee Per Day | Rs. 100 |
| Is Active | true |
| Minimum Stay Months | 0 |
| Suspend Late Fee Until Promised Date | false |
| Notice Period Days | 0 |
| Description | (empty) |

---

## Charge Types

| Field | Value |
|-------|-------|
| Charge ID | 20 |
| Name | Electricity |
| Code | ELEC |
| Default Amount | Rs. 0 |
| Is Recurring | true |
| Is Active | true |

---

## Billing Policy

| Field | Value |
|-------|-------|
| Advance Handling Mode | AdjustAgainstFirstInvoice |
| Booking Expiry Days | 3 |

---

## Owners

| Field | Value |
|-------|-------|
| Owner Record ID | 1008 |
| User ID | 54935fb1-e9b9-4a19-9b0b-7538ebb943aa |
| Full Name | Mukund Jha |
| Ownership Percentage | 100% |
| Is Primary Owner | true |

---

## Staff
No staff members added yet.

---

## Admin Documents
No documents uploaded yet.

---

## Notification Settings

| Notification Type | Display Name | In-App | WhatsApp | Email |
|-------------------|--------------|--------|----------|-------|
| RentOverdue | Rent Overdue | ENABLED | disabled | disabled |
| RentDueSoon | Rent Due Soon | ENABLED | disabled | disabled |
| PaymentReceived | Payment Received | ENABLED | disabled | disabled |
| TenantCheckedIn | Tenant Checked In | ENABLED | disabled | disabled |
| TenantCheckedOut | Tenant Checked Out | ENABLED | disabled | disabled |
| SecurityDepositRefunded | Security Deposit Refunded | ENABLED | disabled | disabled |
| AdvanceForfeited | Advance Forfeited | ENABLED | disabled | disabled |
| AdminDocumentUploaded | Admin Document Uploaded | ENABLED | disabled | disabled |
| StaffAccountCreated | Staff Account Created | ENABLED | disabled | disabled |
| RoomVacancyCreated | Room Vacancy Created | ENABLED | disabled | disabled |
| PromisedPaymentMissed | Promised Payment Missed | ENABLED | disabled | disabled |

**Note:** In-app notifications are enabled for all events. WhatsApp and Email notifications are all currently disabled.

---

## Settings Operations Reference

### Rent Plans
- GET/POST /properties/{id}/rent-plans
- GET/PUT/DELETE /properties/{id}/rent-plans/{planId}

### Charge Types
- GET/POST /properties/{id}/charge-types
- GET/PUT/DELETE /properties/{id}/charge-types/{typeId}

### Billing Policy
- GET /properties/{id}/billing-policy
- PUT /properties/{id}/billing-policy

### Staff Management
- GET/POST /properties/{id}/staff
- GET/PUT/DELETE /properties/{id}/staff/{staffId}

### Owners
- GET/POST /properties/{id}/owners
- GET/PUT/DELETE /properties/{id}/owners/{ownerId}

### Notification Settings
- GET /properties/{id}/notification-settings
- PUT /properties/{id}/notification-settings

### Admin Documents
- GET/POST /properties/{id}/admin-documents
- GET/PUT/DELETE /properties/{id}/admin-documents/{docId}

### Registration Link
- GET /properties/{id}/registration-link
- POST /properties/{id}/registration-link/regenerate
