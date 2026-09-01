# Complete API Endpoint Map
**Base URL:** https://niketanapi.atomis.in/api/v1

---

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/login | Login with email + password, returns JWT |
| POST | /auth/refresh | Refresh access token using refresh token |

---

## Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /users/me | Get current authenticated user profile |
| PUT | /users/{userId} | Update user profile |

---

## Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties | List all properties for owner |
| POST | /properties | Create new property |
| GET | /properties/{id} | Get property details |
| PUT | /properties/{id} | Update property |
| DELETE | /properties/{id} | Delete property |
| GET | /properties/amenities | Get all global amenities |

---

## Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /dashboard/owner | Owner-level portfolio summary |
| GET | /dashboard/property/{id} | Property-level dashboard stats |
| GET | /dashboard/property/{id}/due-rent | List of tenants with due rent |
| GET | /dashboard/property/{id}/monthly-trend | 6-month collection vs expense chart |
| GET | /dashboard/property/{id}/outstanding-payment | Total outstanding amount |
| GET | /dashboard/property/{id}/outstanding-payment/details | Detailed outstanding breakdown |

---

## Floors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/floors | List all floors |
| POST | /properties/{id}/floors | Create floor |
| GET | /properties/{id}/floors/{floorId} | Get floor |
| PUT | /properties/{id}/floors/{floorId} | Update floor |
| DELETE | /properties/{id}/floors/{floorId} | Delete floor |

---

## Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/rooms | List all rooms |
| POST | /properties/{id}/rooms | Create room |
| GET | /properties/{id}/rooms/{roomId} | Get room |
| PUT | /properties/{id}/rooms/{roomId} | Update room |
| DELETE | /properties/{id}/rooms/{roomId} | Delete room |
| GET | /properties/{id}/rooms/by-floor/{floorId} | Rooms by floor |
| GET | /properties/{id}/rooms/{roomId}/beds | Beds in room |

---

## Beds

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/beds/vacant | List vacant beds |
| GET | /properties/{id}/beds/{bedId} | Get bed |
| PUT | /properties/{id}/beds/{bedId} | Update bed |
| DELETE | /properties/{id}/beds/{bedId} | Delete bed |
| PATCH | /properties/{id}/beds/{bedId}/status | Update bed status |

---

## Bed Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/bed-bookings | List bookings |
| POST | /properties/{id}/bed-bookings | Create booking |
| POST | /properties/{id}/bed-bookings/cancel | Cancel booking |
| POST | /properties/{id}/bed-bookings/convert-to-checkin | Convert to check-in |

---

## Tenants

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/tenants | List tenants (paginated) |
| POST | /properties/{id}/tenants | Create tenant |
| GET | /properties/{id}/tenants/{tenantId} | Get tenant |
| PUT | /properties/{id}/tenants/{tenantId} | Update tenant |
| DELETE | /properties/{id}/tenants/{tenantId} | Delete tenant |
| POST | /properties/{id}/tenants/{tenantId}/approve | Approve tenant |
| POST | /properties/{id}/tenants/{tenantId}/reject | Reject tenant |
| POST | /properties/{id}/tenants/{tenantId}/checkout | Checkout tenant |
| POST | /properties/{id}/tenants/{tenantId}/onboarding-link | Generate onboarding link |
| GET | /properties/{id}/tenants/{tenantId}/documents | List documents |
| POST | /properties/{id}/tenants/{tenantId}/documents | Upload document |
| DELETE | /properties/{id}/tenants/{tenantId}/documents/{docId} | Delete document |
| GET | /properties/{id}/tenants/{tenantId}/emergency-contacts | List emergency contacts |
| POST | /properties/{id}/tenants/{tenantId}/emergency-contacts | Add emergency contact |
| DELETE | /properties/{id}/tenants/{tenantId}/emergency-contacts/{contactId} | Remove emergency contact |
| GET | /properties/{id}/tenants/export | Export tenants CSV |
| POST | /properties/{id}/tenants/import | Import tenants |

---

## Tenant Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/tenant-reports | Tenant financial summary |
| GET | /properties/{id}/tenant-reports/{reportId} | Specific tenant report |

---

## Occupancy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/occupancy/active | Current active allocations |
| GET | /properties/{id}/occupancy/summary | Occupancy summary |
| POST | /properties/{id}/occupancy/allocate | Allocate bed to tenant |
| POST | /properties/{id}/occupancy/checkin | Check in tenant |
| POST | /properties/{id}/occupancy/check-in-complete | Complete check-in |
| POST | /properties/{id}/occupancy/checkout | Check out tenant |
| POST | /properties/{id}/occupancy/transfer | Transfer tenant to another bed |
| GET | /properties/{id}/occupancy/export | Export occupancy data |
| POST | /properties/{id}/occupancy/import | Import occupancy data |
| GET | /properties/{id}/occupancy/tenants/{tenantId}/current | Current allocation for tenant |
| GET | /properties/{id}/occupancy/tenants/{tenantId}/history | Allocation history |
| GET | /properties/{id}/occupancy/allocations/{id}/checkout-preview | Checkout financial preview |
| GET | /properties/{id}/occupancy/allocations/{id}/due-settings | Due settings for allocation |

---

## Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/invoices | List invoices (paginated) |
| GET | /properties/{id}/invoices/summary | Invoice financial summary |
| GET | /properties/{id}/invoices/overdue | List overdue invoices |
| GET | /properties/{id}/invoices/{invoiceId} | Get invoice |
| PUT | /properties/{id}/invoices/{invoiceId} | Update invoice |
| GET | /properties/{id}/invoices/tenant/{tenantId} | Invoices for tenant |
| GET | /properties/{id}/invoices/tenant/{tenantId}/statement | Tenant statement |
| POST | /properties/{id}/invoices/generate | Generate rent invoices |
| POST | /properties/{id}/invoices/generate-charge | Generate charge invoice |
| POST | /properties/{id}/invoices/generate-deposit | Generate deposit invoice |
| POST | /properties/{id}/invoices/apply-late-fees | Apply late fees |
| POST | /properties/{id}/invoices/send-due-soon-reminders | Send reminders |
| POST | /properties/{id}/invoices/{invoiceId}/void | Void invoice |
| PATCH | /properties/{id}/invoices/{invoiceId}/promised-date | Update promised date |

---

## Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /properties/{id}/payments | Record payment |
| GET | /properties/{id}/payments/invoice/{invoiceId} | Payments for invoice |
| GET | /properties/{id}/payments/tenant/{tenantId} | Payments for tenant |
| POST | /properties/{id}/payments/auto-allocate | Auto-allocate payments |

---

## Advance Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/advance-payments | List advance payments |
| POST | /properties/{id}/advance-payments | Record advance payment |
| GET | /properties/{id}/advance-payments/tenant/{tenantId} | By tenant |
| POST | /properties/{id}/advance-payments/apply-to-invoice | Apply to invoice |
| POST | /properties/{id}/advance-payments/forfeit | Forfeit advance |
| GET | /properties/{id}/advance-payments/export | Export |
| POST | /properties/{id}/advance-payments/import | Import |

---

## Security Deposits

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/security-deposits | List deposits |
| POST | /properties/{id}/security-deposits | Record deposit |
| GET | /properties/{id}/security-deposits/liability-report | Liability report |
| GET | /properties/{id}/security-deposits/tenant/{tenantId} | By tenant |
| GET | /properties/{id}/security-deposits/allocation/{allocationId} | By allocation |
| POST | /properties/{id}/security-deposits/refund | Refund deposit |
| GET | /properties/{id}/security-deposits/export | Export |
| POST | /properties/{id}/security-deposits/import | Import |
| PATCH | /properties/{id}/security-deposits/{id}/promised-date | Update promised date |

---

## Expenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/expenses | List expenses |
| POST | /properties/{id}/expenses | Create expense |
| GET | /properties/{id}/expenses/summary | Summary |
| GET | /properties/{id}/expenses/ledger | Expense ledger |
| GET | /properties/{id}/expenses/mine | My expenses |
| GET | /properties/{id}/expenses/{expenseId} | Get expense |
| PUT | /properties/{id}/expenses/{expenseId} | Update expense |
| DELETE | /properties/{id}/expenses/{expenseId} | Delete expense |
| POST | /properties/{id}/expenses/approve | Approve expense |
| POST | /properties/{id}/expenses/reject | Reject expense |
| GET | /properties/{id}/expenses/export | Export |
| GET | /properties/{id}/expenses/{expenseId}/attachments | Get attachments |
| POST | /properties/{id}/expenses/{expenseId}/attachments | Add attachment |

---

## Expense Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/expense-categories | List categories |
| POST | /properties/{id}/expense-categories | Create category |
| PUT | /properties/{id}/expense-categories/{categoryId} | Update category |
| DELETE | /properties/{id}/expense-categories/{categoryId} | Delete category |

---

## Settings

### Rent Plans
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/rent-plans | List rent plans |
| POST | /properties/{id}/rent-plans | Create rent plan |
| PUT | /properties/{id}/rent-plans/{planId} | Update rent plan |
| DELETE | /properties/{id}/rent-plans/{planId} | Delete rent plan |

### Charge Types
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/charge-types | List charge types |
| POST | /properties/{id}/charge-types | Create charge type |
| PUT | /properties/{id}/charge-types/{typeId} | Update charge type |
| DELETE | /properties/{id}/charge-types/{typeId} | Delete charge type |

### Billing Policy
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/billing-policy | Get billing policy |
| PUT | /properties/{id}/billing-policy | Update billing policy |

### Staff
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/staff | List staff |
| POST | /properties/{id}/staff | Add staff |
| GET | /properties/{id}/staff/{staffId} | Get staff member |
| PUT | /properties/{id}/staff/{staffId} | Update staff |
| DELETE | /properties/{id}/staff/{staffId} | Remove staff |

### Owners
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/owners | List owners |
| POST | /properties/{id}/owners | Add owner |
| GET | /properties/{id}/owners/{ownerId} | Get owner |
| PUT | /properties/{id}/owners/{ownerId} | Update owner |
| DELETE | /properties/{id}/owners/{ownerId} | Remove owner |

### Notification Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/notification-settings | Get notification settings |
| PUT | /properties/{id}/notification-settings | Update notification settings |

### Registration Link
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/registration-link | Get current registration link |
| POST | /properties/{id}/registration-link/regenerate | Regenerate link |

### Admin Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/admin-documents | List documents |
| POST | /properties/{id}/admin-documents | Upload document |
| GET | /properties/{id}/admin-documents/{docId} | Get document |
| DELETE | /properties/{id}/admin-documents/{docId} | Delete document |

### Amenities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/amenities | List property amenities |
| POST | /properties/{id}/amenities | Add amenity |
| PUT | /properties/{id}/amenities/{amenityId} | Update amenity |
| DELETE | /properties/{id}/amenities/{amenityId} | Remove amenity |

---

## Modules & Permissions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /modules | List all modules |
| GET | /modules/{moduleId} | Get module |
| GET | /modules/module-permissions | All module-permission combos |
| GET | /modules/permissions | List all permissions |

---

## Structure (Import/Export)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/{id}/structure/export | Export property structure (Excel) |
| POST | /properties/{id}/structure/import | Import property structure |
