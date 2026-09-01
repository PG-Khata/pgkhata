# Invoices and Payments Data

## Invoice Summary

| Metric | Value |
|--------|-------|
| Total Invoices | 0 |
| Pending Count | 0 |
| Partial Count | 0 |
| Overdue Count | 0 |
| Total Due Amount | Rs. 0 |
| Total Collected This Month | Rs. 0 |

---

## Invoices List
No invoices found (no tenants allocated yet).

---

## Security Deposits

### Liability Report

| Metric | Value |
|--------|-------|
| Active Deposit Count | 0 |
| Total Held Amount | Rs. 0 |
| Total Refunded Amount | Rs. 0 |

### Security Deposit Operations

| Operation | Endpoint |
|-----------|----------|
| List deposits | GET /properties/{id}/security-deposits |
| Get by tenant | GET /properties/{id}/security-deposits/tenant/{tenantId} |
| Get by allocation | GET /properties/{id}/security-deposits/allocation/{allocationId} |
| Refund deposit | POST /properties/{id}/security-deposits/refund |
| Liability report | GET /properties/{id}/security-deposits/liability-report |
| Export | GET /properties/{id}/security-deposits/export |
| Import | POST /properties/{id}/security-deposits/import |
| Update promised date | PATCH /properties/{id}/security-deposits/{id}/promised-date |

---

## Advance Payments

| Operation | Endpoint |
|-----------|----------|
| List advance payments | GET /properties/{id}/advance-payments |
| Get by tenant | GET /properties/{id}/advance-payments/tenant/{tenantId} |
| Apply to invoice | POST /properties/{id}/advance-payments/apply-to-invoice |
| Forfeit advance | POST /properties/{id}/advance-payments/forfeit |
| Export | GET /properties/{id}/advance-payments/export |
| Import | POST /properties/{id}/advance-payments/import |

---

## Invoice Operations

| Operation | Endpoint |
|-----------|----------|
| List invoices | GET /properties/{id}/invoices |
| Get single invoice | GET /properties/{id}/invoices/{invoiceId} |
| Invoice summary | GET /properties/{id}/invoices/summary |
| Overdue invoices | GET /properties/{id}/invoices/overdue |
| Tenant invoices | GET /properties/{id}/invoices/tenant/{tenantId} |
| Tenant statement | GET /properties/{id}/invoices/tenant/{tenantId}/statement |
| Generate invoice | POST /properties/{id}/invoices/generate |
| Generate charge | POST /properties/{id}/invoices/generate-charge |
| Generate deposit invoice | POST /properties/{id}/invoices/generate-deposit |
| Apply late fees | POST /properties/{id}/invoices/apply-late-fees |
| Send due soon reminders | POST /properties/{id}/invoices/send-due-soon-reminders |
| Void invoice | POST /properties/{id}/invoices/{invoiceId}/void |
| Update promised date | PATCH /properties/{id}/invoices/{invoiceId}/promised-date |

---

## Payments

| Operation | Endpoint |
|-----------|----------|
| Record payment | POST /properties/{id}/payments |
| Get payments for invoice | GET /properties/{id}/payments/invoice/{invoiceId} |
| Get payments for tenant | GET /properties/{id}/payments/tenant/{tenantId} |
| Auto-allocate payments | POST /properties/{id}/payments/auto-allocate |
