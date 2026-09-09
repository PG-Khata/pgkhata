# Production migration reconciliation

The production database must be reconciled before automatic migrations are enabled. Read-only inspection on 2026-09-10 confirmed 14 migration ledger rows (0000-0013), while the tables, columns, indexes, and foreign keys from 0014-0022 already exist except for two constraint registrations. The existing 14 hashes match the repository. `bill.access_token` has no duplicates and `bill_delivery` has no orphan rows. A valid unique index named `bill_access_token_unique` already exists, but it is not attached to a PostgreSQL unique constraint.

The Session 4 count-only preflight also passed every check supported by the current production schema: cross-property references, assigned-bed consistency, active-bed occupancy, singleton duplicates, normalized amenity duplicates, duplicate readings, invalid bill amounts, and non-positive payments all returned zero. `occupancy_history` is not present because migration 0023 has not run; migration 0025 rechecks it transactionally after 0023 creates it. No production data was changed during inspection.

## Exact proposed change

1. Take a Neon restore point or branch immediately before the change.
2. Re-run `pnpm --filter @pgkhata/db inspect:constraints` and the read-only artifact/schema checks. Stop if any count is nonzero, the ledger is not exactly 14 rows ending at `1788146006929`, any expected 0014-0022 object is missing, access tokens are duplicated, or bill deliveries are orphaned.
3. Execute `reconciliation/production-14-to-22.sql` as one transaction. It acquires the same advisory lock as deploy migrations, attaches the existing valid `bill_access_token_unique` index as the unique constraint without rebuilding it, adds the missing foreign key on `bill_delivery.bill_id`, then records migrations 0014-0022 with their repository hashes.
4. Run `reconciliation/0024-legacy-document-review.sql` read-only and retain the result for manual review. Recognized `admin/...` and `kyc/...` R2 URLs are converted to private object keys by 0024; arbitrary external URLs are intentionally not trusted or exposed.
5. Run `pnpm --filter @pgkhata/db migrate:deploy`. Expected result: migrations 0023, 0024, and 0025 applied. Migration 0025 first aborts on dirty cross-property, occupancy, or duplicate data; it does not merge or delete rows. Run deploy again and expect zero migrations to prove idempotency.
6. Verify 26 ledger rows, the billing-integrity and Session 4 constraints, `set_updated_at` triggers, the `rate_limit` table, private document key columns, application health, an existing invoice link, and one bill-delivery read. Re-run the legacy-document report; returned rows remain blocked pending manual review. If any transactional statement fails, PostgreSQL rolls back automatically. If post-commit verification fails, restore the Neon branch/restore point.

Do not execute the reconciliation SQL against production until the owner explicitly approves this exact file. The deploy runner first validates local artifacts and recorded hashes, rehearses pending SQL inside a rolled-back transaction, and refuses conflicting drift.
