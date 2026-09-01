# Expenses Data

## Expense Summary

| Metric | Value |
|--------|-------|
| Total Expenses | 0 |
| Pending Count | 0 |
| Approved Count | 0 |
| Rejected Count | 0 |
| Total Approved Amount | Rs. 0 |
| Total Pending Amount | Rs. 0 |
| Current Month Approved | Rs. 0 |

---

## Expense Ledger (Today)

| Metric | Value |
|--------|-------|
| Date | 2026-08-29 |
| Total Approved Amount | Rs. 0 |
| Entry Count | 0 |
| Entries | (none) |

---

## Expense Categories
None created yet.

---

## Expenses List
No expenses recorded yet.

---

## Expense Operations

| Operation | Endpoint |
|-----------|----------|
| List expenses | GET /properties/{id}/expenses |
| Get single expense | GET /properties/{id}/expenses/{expenseId} |
| Create expense | POST /properties/{id}/expenses |
| Update expense | PUT /properties/{id}/expenses/{expenseId} |
| Delete expense | DELETE /properties/{id}/expenses/{expenseId} |
| Approve expense | POST /properties/{id}/expenses/approve |
| Reject expense | POST /properties/{id}/expenses/reject |
| Expense summary | GET /properties/{id}/expenses/summary |
| Expense ledger | GET /properties/{id}/expenses/ledger |
| My expenses | GET /properties/{id}/expenses/mine |
| Export expenses | GET /properties/{id}/expenses/export |
| Get attachments | GET /properties/{id}/expenses/{expenseId}/attachments |
| Add attachment | POST /properties/{id}/expenses/{expenseId}/attachments |

---

## Expense Categories Operations

| Operation | Endpoint |
|-----------|----------|
| List categories | GET /properties/{id}/expense-categories |
| Create category | POST /properties/{id}/expense-categories |
| Update category | PUT /properties/{id}/expense-categories/{categoryId} |
| Delete category | DELETE /properties/{id}/expense-categories/{categoryId} |
