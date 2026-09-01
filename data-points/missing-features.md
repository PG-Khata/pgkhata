# PGKhata — Missing Features (vs Niketan)

**Generated:** 2026-08-30
**Source:** Niketan API deep scan (data-points/niketan/)
**Last Updated:** 2026-08-31

---

## Status Summary

| Priority | Total | Completed | Remaining |
|----------|-------|-----------|-----------|
| HIGH | 11 | 11 ✅ | 0 |
| MEDIUM | 13 | 13 ✅ | 0 |
| LOW | 6 | 6 ✅ | 0 |
| **Total** | **30** | **30 ✅** | **0** |

### All Features Complete (30/30)
- ✅ #1-11: All HIGH priority (Tasks 1-16, 2026-08-30)
- ✅ #12: Bed Bookings (2026-08-31)
- ✅ #13: Tenant KYC Documents with R2 storage (2026-08-31)
- ✅ #14: Tenant Financial Reports (2026-08-31)
- ✅ #15: Checkout Financial Preview (2026-08-31)
- ✅ #16: Bed Transfer (2026-08-31)
- ✅ #17: Invoice Voiding (2026-08-31)
- ✅ #18: Promised Payment Date (2026-08-31)
- ✅ #19: Auto-Allocate Payments (2026-08-31)
- ✅ #20: Staff Management with role-based permissions (2026-08-31)
- ✅ #21: Notification Preferences (2026-08-31)
- ✅ #22: Billing Policy Configuration (2026-08-31)
- ✅ #23: CSV Import/Export (2026-08-31)
- ✅ #24: Outstanding Payment Drill-Down (2026-08-31)
- ✅ #25: Property Amenities (2026-08-31)
- ✅ #26: Admin Document Storage with R2 (2026-08-31)
- ✅ #27: Emergency Contacts (2026-08-31)
- ✅ #28: QR Code for Registration (2026-08-31)
- ✅ #29: Modules & Permissions (2026-08-31)
- ✅ #30: Property Structure Import/Export (2026-08-31)

### Bonus Features (Beyond missing-features.md)
- ✅ Manual tenant approval workflow (gates all tenant creation)
- ✅ Advance payment application UI
- ✅ Cloudflare R2 storage integration for documents
- ✅ WhatsApp Business API integration (bill notifications + payment reminders)
- ✅ Complete frontend UI for all new features

---

## Priority: HIGH

### 1. Floors

Niketan has a 3-level hierarchy: Floor → Room → Bed. PGKhata only has Room.

**What to build:**
- `floor` table: id, propertyId, name/number, position (ordering)
- CRUD endpoints: `GET/POST /v1/properties/:pid/floors`, `GET/PUT/DELETE /v1/properties/:pid/floors/:fid`
- Room gets optional `floorId` foreign key
- Frontend: floor selector on room creation, floor-grouped room view

**Niketan endpoints:**
```
GET    /properties/{id}/floors
POST   /properties/{id}/floors
GET    /properties/{id}/floors/{floorId}
PUT    /properties/{id}/floors/{floorId}
DELETE /properties/{id}/floors/{floorId}
```

---

### 2. Individual Bed Tracking

Niketan tracks individual beds within rooms (bed number, status: vacant/occupied/maintenance). PGKhata only tracks room capacity.

**What to build:**
- `bed` table: id, roomId, number, status (vacant/occupied/maintenance), monthlyRent (optional override)
- Auto-create beds when room is created (based on capacity)
- Bed status updates
- Vacant bed listing for tenant assignment

**Niketan endpoints:**
```
GET    /properties/{id}/beds/vacant
GET    /properties/{id}/beds/{bedId}
PUT    /properties/{id}/beds/{bedId}
DELETE /properties/{id}/beds/{bedId}
PATCH  /properties/{id}/beds/{bedId}/status
GET    /properties/{id}/rooms/{roomId}/beds
```

---

### 3. Rent Plans

Niketan has configurable rent plans with due day, late fee per day, minimum stay, and notice period. PGKhata has a flat rent amount per room.

**What to build:**
- `rent_plan` table: id, propertyId, name, monthlyRent, securityDeposit, dueDay, lateFeePerDay, isActive, minStayMonths, noticePeriodDays, description
- Room references a rent plan instead of (or in addition to) a flat rent
- Late fee auto-calculation based on due day + late fee per day

**Niketan fields:**
```
Plan Name, Monthly Rent, Security Deposit, Due Day (of month),
Late Fee Per Day, Is Active, Minimum Stay Months,
Suspend Late Fee Until Promised Date, Notice Period Days, Description
```

---

### 4. Configurable Charge Types

Niketan has configurable charge types (electricity, water, maintenance, etc.) with recurring flag. PGKhata hardcodes electricity.

**What to build:**
- `charge_type` table: id, propertyId, name, code, defaultAmount, isRecurring, isActive
- Bills can include multiple charge types, not just rent + electricity
- Frontend: charge type management in property settings

**Niketan fields:**
```
Name, Code (ELEC, WATER, etc.), Default Amount, Is Recurring, Is Active
```

---

### 5. Late Fee Auto-Application

Niketan can automatically apply late fees to overdue invoices based on the rent plan's late fee per day setting.

**What to build:**
- Endpoint: `POST /v1/properties/:pid/bills/apply-late-fees`
- Calculate: days overdue × late fee per day
- Add late fee as a line item on the bill
- Optional: suspend late fee until promised date

**Niketan endpoint:**
```
POST /properties/{id}/invoices/apply-late-fees
```

---

### 6. Advance Payments

Niketan tracks advance payments separately — they can be applied to future invoices or forfeited.

**What to build:**
- `advance_payment` table: id, tenantId, amount, date, status (available/applied/forfeited)
- Apply advance to invoice: reduces invoice balance
- Forfeit advance: marks as forfeited (no refund)
- Dashboard: show total advance balance per tenant

**Niketan endpoints:**
```
GET    /properties/{id}/advance-payments
POST   /properties/{id}/advance-payments
GET    /properties/{id}/advance-payments/tenant/{tenantId}
POST   /properties/{id}/advance-payments/apply-to-invoice
POST   /properties/{id}/advance-payments/forfeit
```

---

### 7. Security Deposit Tracking

Niketan has dedicated security deposit tracking with liability report and refund workflow. PGKhata has a `deposit` field on tenant but no lifecycle.

**What to build:**
- `security_deposit` table: id, tenantId, propertyId, amount, status (held/refunded/partial), refundAmount, refundDate, promisedDate
- Liability report: total held, total refunded, net liability
- Refund workflow: partial/full refund with date tracking

**Niketan endpoints:**
```
GET    /properties/{id}/security-deposits
POST   /properties/{id}/security-deposits
GET    /properties/{id}/security-deposits/liability-report
POST   /properties/{id}/security-deposits/refund
```

---

### 8. Expense Tracking

Niketan has a full expense module with categories, approval workflow, attachments, and ledger. PGKhata has no expense tracking.

**What to build:**
- `expense` table: id, propertyId, category, amount, date, description, status (pending/approved/rejected), createdBy, approvedBy
- `expense_category` table: id, propertyId, name
- Approval workflow: staff submits, owner approves/rejects
- Expense summary: total by period, by category
- Expense ledger: daily breakdown

**Niketan endpoints:**
```
GET    /properties/{id}/expenses
POST   /properties/{id}/expenses
GET    /properties/{id}/expenses/summary
GET    /properties/{id}/expenses/ledger
POST   /properties/{id}/expenses/approve
POST   /properties/{id}/expenses/reject
GET    /properties/{id}/expense-categories
POST   /properties/{id}/expense-categories
```

---

### 9. Tenant Approval Workflow

Niketan has approve/reject for tenants (from public signup or manual entry). PGKhata auto-activates tenants.

**What to build:**
- Tenant status adds: `pending` (from signup), `approved`, `rejected`
- Public signup creates tenant with `pending` status
- Owner can approve or reject
- Onboarding link generation after approval

**Niketan endpoints:**
```
POST /properties/{id}/tenants/{tenantId}/approve
POST /properties/{id}/tenants/{tenantId}/reject
POST /properties/{id}/tenants/{tenantId}/onboarding-link
```

---

### 10. Dashboard: Monthly Trend Chart

Niketan shows a 6-month collection vs expense trend chart. PGKhata dashboard has no charts yet.

**What to build:**
- Endpoint: `GET /v1/dashboard/property/:pid/monthly-trend`
- Returns last 6 months: { month, collected, expenses }
- Frontend: Recharts AreaChart or BarChart on property dashboard

**Niketan endpoint:**
```
GET /dashboard/property/{id}/monthly-trend
```

---

### 11. Dashboard: Due Rent List

Niketan shows a list of tenants with due rent on the dashboard. PGKhata only shows aggregate pending amount.

**What to build:**
- Endpoint: `GET /v1/dashboard/property/:pid/due-rent`
- Returns: tenant name, room, amount due, days overdue
- Frontend: table on property dashboard

**Niketan endpoint:**
```
GET /dashboard/property/{id}/due-rent
```

---

## Priority: MEDIUM

### 12. Bed Bookings

Reserve a bed before tenant check-in. Can be converted to check-in or cancelled.

**Niketan endpoints:**
```
GET    /properties/{id}/bed-bookings
POST   /properties/{id}/bed-bookings
POST   /properties/{id}/bed-bookings/cancel
POST   /properties/{id}/bed-bookings/convert-to-checkin
```

---

### 13. Tenant KYC Documents

Upload and manage documents per tenant (Aadhaar, PAN, etc.).

**Niketan endpoints:**
```
GET    /properties/{id}/tenants/{tenantId}/documents
POST   /properties/{id}/tenants/{tenantId}/documents
DELETE /properties/{id}/tenants/{tenantId}/documents/{docId}
```

---

### 14. Tenant Financial Reports

Per-tenant financial summary: total billed, total paid, balance, payment history.

**Niketan endpoints:**
```
GET /properties/{id}/tenant-reports
GET /properties/{id}/tenant-reports/{reportId}
```

---

### 15. Checkout with Financial Preview

Before checking out a tenant, show a financial preview: outstanding rent, deposit refund, final settlement.

**Niketan endpoint:**
```
GET /properties/{id}/occupancy/allocations/{id}/checkout-preview
```

---

### 16. Bed Transfer

Move a tenant from one bed to another without checkout/check-in cycle.

**Niketan endpoint:**
```
POST /properties/{id}/occupancy/transfer
```

---

### 17. Invoice Voiding

Void an invoice (mark as cancelled without deleting).

**Niketan endpoint:**
```
POST /properties/{id}/invoices/{invoiceId}/void
```

---

### 18. Promised Payment Date

Track when a tenant promises to pay. Suspend late fees until that date.

**Niketan endpoint:**
```
PATCH /properties/{id}/invoices/{invoiceId}/promised-date
```

---

### 19. Auto-Allocate Payments

Automatically allocate a payment across multiple outstanding invoices for a tenant.

**Niketan endpoint:**
```
POST /properties/{id}/payments/auto-allocate
```

---

### 20. Staff Management

Add staff members with roles (manager, warden, accountant). PGKhata only has owners.

**Niketan endpoints:**
```
GET    /properties/{id}/staff
POST   /properties/{id}/staff
PUT    /properties/{id}/staff/{staffId}
DELETE /properties/{id}/staff/{staffId}
```

---

### 21. Notification Preferences

Per-event notification settings (in-app, WhatsApp, email toggle).

**Niketan events:**
```
RentOverdue, RentDueSoon, PaymentReceived, TenantCheckedIn,
TenantCheckedOut, SecurityDepositRefunded, AdvanceForfeited,
AdminDocumentUploaded, StaffAccountCreated, RoomVacancyCreated,
PromisedPaymentMissed
```

---

### 22. Billing Policy

Configure advance handling mode, booking expiry days.

**Niketan fields:**
```
Advance Handling Mode: AdjustAgainstFirstInvoice
Booking Expiry Days: 3
```

---

### 23. CSV Import/Export

Import/export for tenants, occupancy, expenses, security deposits.

**Niketan endpoints:**
```
GET  /properties/{id}/tenants/export
POST /properties/{id}/tenants/import
GET  /properties/{id}/occupancy/export
POST /properties/{id}/occupancy/import
GET  /properties/{id}/expenses/export
GET  /properties/{id}/security-deposits/export
```

---

### 24. Outstanding Payment Breakdown

Detailed breakdown of outstanding amounts: by tenant, by age (current/30/60/90+ days).

**Niketan endpoints:**
```
GET /dashboard/property/{id}/outstanding-payment
GET /dashboard/property/{id}/outstanding-payment/details
```

---

## Priority: LOW

### 25. Property Amenities

Track amenities per property (WiFi, AC, Laundry, Power Backup, Meals, Parking, Gym).

**Niketan endpoints:**
```
GET    /properties/{id}/amenities
POST   /properties/{id}/amenities
PUT    /properties/{id}/amenities/{amenityId}
DELETE /properties/{id}/amenities/{amenityId}
```

---

### 26. Admin Document Storage

Upload and manage property-level documents (agreements, licenses, etc.).

**Niketan endpoints:**
```
GET    /properties/{id}/admin-documents
POST   /properties/{id}/admin-documents
DELETE /properties/{id}/admin-documents/{docId}
```

---

### 27. Emergency Contacts

Per-tenant emergency contact information.

**Niketan endpoints:**
```
GET    /properties/{id}/tenants/{tenantId}/emergency-contacts
POST   /properties/{id}/tenants/{tenantId}/emergency-contacts
DELETE /properties/{id}/tenants/{tenantId}/emergency-contacts/{contactId}
```

---

### 28. QR Code for Registration Link

Generate a QR code image for the tenant registration link.

**Niketan:** Returns base64 PNG in the registration link API response.

---

### 29. Modules & Permissions

Granular permission system for different staff roles.

**Niketan endpoints:**
```
GET /modules
GET /modules/module-permissions
GET /modules/permissions
```

---

### 30. Property Structure Import/Export

Export full floor/room/bed hierarchy as Excel. Import from Excel.

**Niketan endpoints:**
```
GET  /properties/{id}/structure/export
POST /properties/{id}/structure/import
```

---

## Implementation Order (Suggested)

| Phase | Features | Effort |
|-------|----------|--------|
| **Phase 1** | Floors, Beds, Rent Plans, Charge Types | 1 week |
| **Phase 2** | Late Fees, Advance Payments, Security Deposits | 1 week |
| **Phase 3** | Expense Tracking, Tenant Approval | 1 week |
| **Phase 4** | Dashboard charts (monthly trend, due rent, outstanding) | 3 days |
| **Phase 5** | Staff, Notification Preferences, Billing Policy | 3 days |
| **Phase 6** | Documents, Emergency Contacts, Import/Export | 3 days |
| **Phase 7** | Amenities, QR Code, Permissions | 2 days |

---

## Database Changes Required

### New Tables
- `floor` (id, propertyId, name, position)
- `bed` (id, roomId, number, status, monthlyRent)
- `rent_plan` (id, propertyId, name, monthlyRent, securityDeposit, dueDay, lateFeePerDay, isActive, minStayMonths, noticePeriodDays)
- `charge_type` (id, propertyId, name, code, defaultAmount, isRecurring, isActive)
- `expense` (id, propertyId, categoryId, amount, date, description, status, createdBy, approvedBy)
- `expense_category` (id, propertyId, name)
- `advance_payment` (id, tenantId, amount, date, status)
- `security_deposit` (id, tenantId, propertyId, amount, status, refundAmount, refundDate)
- `bed_booking` (id, bedId, tenantName, tenantPhone, status, date)
- `tenant_document` (id, tenantId, type, url, uploadedAt)
- `emergency_contact` (id, tenantId, name, phone, relation)
- `staff` (id, propertyId, userId, role)
- `notification_preference` (id, propertyId, eventType, inApp, whatsapp, email)

### Modified Tables
- `room` — add `floorId`, `rentPlanId`
- `tenant` — add `status: pending/approved/rejected`, `advanceBalance`
- `bill` — add `lateFee`, `chargeBreakdown` (JSON), `voidedAt`
- `payment` — add `autoAllocated` flag
