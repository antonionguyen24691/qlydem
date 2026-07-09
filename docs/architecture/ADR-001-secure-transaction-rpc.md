# ADR-001: Commit POS and receipts through PostgreSQL transaction RPCs

## Status

Accepted for the next deployment.

## Context

The prior API created orders, inventory movements, debt ledger rows, receipts and cashbook rows as separate service-role requests. A failure or concurrent POS checkout could leave partial data, accept client-modified prices/actors or make stock negative.

## Decision

Use `create_sales_order_secure` and `create_receipt_secure` in migration `20260710_secure_transactions_rls.sql` as the only write path for POS checkout and receipt collection.

- API authenticates the actor and passes only normalized IDs/quantities/payment information.
- The database reads product price/status, locks inventory/customer/debt rows and commits the complete document or rolls it back.
- Each side-effecting request requires a per-actor idempotency key.
- RLS plus revoked `anon`/`authenticated` grants force business-table access through server APIs.

## Trade-offs

- Deployment must apply the database migration before API code; old API code cannot use the new functions.
- SQL business logic is more involved than client-side calculations, but gives a single source of truth for money, inventory and debt.
- `history_clear_backups` is a logical same-database archive, not disaster recovery. Scheduled external backup remains mandatory.

## Consequences

- POS price fields now display catalog price; ad-hoc price changes must go through the approved price-update path until a separately authorized override flow is added.
- `department` permission scope fails closed as `own` until the organization/department data model exists.
- Production rollout requires migration verification, authenticated POS/receipt smoke tests and an anon-key direct-access probe.
