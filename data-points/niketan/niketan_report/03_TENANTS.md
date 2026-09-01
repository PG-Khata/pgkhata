# Tenants Data

## Tenant Summary Report

| Metric | Value |
|--------|-------|
| Total Tenant Count | 0 |
| Total Security Deposit Pending | Rs. 0 |
| Total Advance Available Balance | Rs. 0 |
| Total Rent Pending | Rs. 0 |

---

## Tenant Lists (by Status)

### Active Tenants
- **Total:** 0 (none)

### Pending Tenants (Awaiting Approval)
- **Total:** 0 (none)

### Checked-Out Tenants
- **Total:** 0 (none)

### Rejected Tenants
- **Total:** 0 (none)

---

## Tenant Management Features (Available via API)

Based on the API endpoints discovered, the following operations are available for each tenant:

| Operation | Endpoint |
|-----------|----------|
| List all tenants | GET /properties/{id}/tenants |
| Get single tenant | GET /properties/{id}/tenants/{tenantId} |
| Approve tenant | POST /properties/{id}/tenants/{tenantId}/approve |
| Reject tenant | POST /properties/{id}/tenants/{tenantId}/reject |
| Checkout tenant | POST /properties/{id}/tenants/{tenantId}/checkout |
| View documents | GET /properties/{id}/tenants/{tenantId}/documents |
| Upload document | POST /properties/{id}/tenants/{tenantId}/documents |
| Delete document | DELETE /properties/{id}/tenants/{tenantId}/documents/{docId} |
| Emergency contacts | GET/POST/DELETE /properties/{id}/tenants/{tenantId}/emergency-contacts |
| Generate onboarding link | POST /properties/{id}/tenants/{tenantId}/onboarding-link |
| Export tenants | GET /properties/{id}/tenants/export |
| Import tenants | POST /properties/{id}/tenants/import |

---

## Tenant Registration

A unique registration link is generated for this property:
- **Registration URL:** https://niketan.atomis.in/register/5372dfd98d1e4505bec2079c2c9d591ed62617126f154e2ebc75ff8e40d628e4
- **Token:** 5372dfd98d1e4505bec2079c2c9d591ed62617126f154e2ebc75ff8e40d628e4
- A QR code is also available (base64 PNG embedded in API response)
- Link can be regenerated: POST /properties/{id}/registration-link/regenerate

---

## Occupancy Summary

| Metric | Value |
|--------|-------|
| Property | Premium Boys PG |
| Total Beds | 0 |
| Occupied Beds | 0 |
| Available Beds | 0 |
| Maintenance Beds | 0 |
| Occupancy Percentage | 0% |

### Occupancy Operations Available

| Operation | Endpoint |
|-----------|----------|
| View active occupancy | GET /properties/{id}/occupancy/active |
| Allocate bed | POST /properties/{id}/occupancy/allocate |
| Check-in tenant | POST /properties/{id}/occupancy/checkin |
| Complete check-in | POST /properties/{id}/occupancy/check-in-complete |
| Checkout tenant | POST /properties/{id}/occupancy/checkout |
| Transfer tenant | POST /properties/{id}/occupancy/transfer |
| Export occupancy | GET /properties/{id}/occupancy/export |
| Import occupancy | POST /properties/{id}/occupancy/import |
| Tenant current allocation | GET /properties/{id}/occupancy/tenants/{tenantId}/current |
| Tenant history | GET /properties/{id}/occupancy/tenants/{tenantId}/history |
| Checkout preview | GET /properties/{id}/occupancy/allocations/{id}/checkout-preview |
| Due settings | GET /properties/{id}/occupancy/allocations/{id}/due-settings |
