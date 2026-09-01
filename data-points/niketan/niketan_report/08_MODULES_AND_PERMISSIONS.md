# Modules and Permissions

## Application Modules (15 Total)

| ID | Module Name | Module Code | Display Order |
|----|-------------|-------------|---------------|
| 1 | Property | PROPERTY | 1 |
| 2 | Floor | FLOOR | 2 |
| 3 | Room | ROOM | 3 |
| 4 | Bed | BED | 4 |
| 5 | Tenant | TENANT | 5 |
| 6 | Rent | RENT | 6 |
| 7 | Expense | EXPENSE | 7 |
| 8 | Complaint | COMPLAINT | 8 |
| 9 | Cleaning | CLEANING | 9 |
| 10 | Dashboard | DASHBOARD | 10 |
| 11 | Reports | REPORTS | 11 |
| 12 | Role | ROLE | 12 |
| 13 | AdminDocument | ADMINDOC | 13 |
| 14 | Notification | NOTIFICATION | 14 |
| 15 | Settings | SETTINGS | 15 |

---

## Permission Types (7 Total)

| ID | Permission Name | Permission Code |
|----|-----------------|-----------------|
| 1 | View | VIEW |
| 2 | Create | CREATE |
| 3 | Update | UPDATE |
| 4 | Delete | DELETE |
| 5 | Approve | APPROVE |
| 6 | Assign | ASSIGN |
| 7 | Export | EXPORT |

---

## Module-Permission Matrix

Each module has all 7 permissions available. The Owner role has all permissions by default.
Staff roles can be assigned granular permissions per module.

| Module | VIEW | CREATE | UPDATE | DELETE | APPROVE | ASSIGN | EXPORT |
|--------|------|--------|--------|--------|---------|--------|--------|
| Property | Y | Y | Y | Y | Y | Y | Y |
| Floor | Y | Y | Y | Y | Y | Y | Y |
| Room | Y | Y | Y | Y | Y | Y | Y |
| Bed | Y | Y | Y | Y | Y | Y | Y |
| Tenant | Y | Y | Y | Y | Y | Y | Y |
| Rent | Y | Y | Y | Y | Y | Y | Y |
| Expense | Y | Y | Y | Y | Y | Y | Y |
| Complaint | Y | Y | Y | Y | Y | Y | Y |
| Cleaning | Y | Y | Y | Y | Y | Y | Y |
| Dashboard | Y | Y | Y | Y | Y | Y | Y |
| Reports | Y | Y | Y | Y | Y | Y | Y |
| Role | Y | Y | Y | Y | Y | Y | Y |
| AdminDocument | Y | Y | Y | Y | Y | Y | Y |
| Notification | Y | Y | Y | Y | Y | Y | Y |
| Settings | Y | Y | Y | Y | Y | Y | Y |

---

## Module Operations

- GET /modules — List all modules
- GET /modules/{moduleId} — Get specific module
- GET /modules/module-permissions — Get module-permission combinations
- GET /modules/permissions — Get list of all permissions

---

## Role Management

| Operation | Endpoint |
|-----------|----------|
| List roles | GET /settings/roles |
| Create role | POST /settings/roles |
| Assign permissions to role | PUT /settings/roles/{roleId} |

---

## Notable Features (from JS bundle analysis)

Modules that exist in the platform but may be optional/feature-flagged:
- **Complaint** module — tenant complaint tracking
- **Cleaning** module — room cleaning schedule management
- **Reports** module — exportable reports
- **AdminDocument** module — admin-uploaded documents (property docs, agreements)
