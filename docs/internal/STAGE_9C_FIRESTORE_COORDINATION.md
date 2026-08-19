# Stage 9C — Firestore coordination

## Goal

Allow multiple Cloud Run instances without duplicate commands, overlapping work in one session, or process-local usage accounting.

## Collections

| Collection | Purpose | Retention |
|---|---|---|
| `mebelflowGatewaySessions` | lease token, lease expiry, session token/cost ledger | TTL on `ttlAt` after inactivity |
| `mebelflowGatewayTenants` | persistent spend ledger and short-lived budget reservations | retained for billing/audit; expired reservations pruned transactionally |
| `mebelflowGatewayRequests` | idempotency keys | TTL after 24 hours |
| `mebelflowGatewayRateWindows` | fixed one-minute RPM counters | TTL after two minutes |

Document IDs are SHA-256 hashes of scoped identifiers. Transactions coordinate each operation. A session lease carries an opaque token, so a timed-out old request cannot release a newer lease.

## Google Cloud setup

1. Enable Firestore API and create a Native-mode database close to Cloud Run.
2. Give only the API service account `roles/datastore.user`; do not ship service-account JSON in the image.
3. Enable TTL on `ttlAt` for the three ephemeral collections above.
4. Put the dedicated OpenAI key in Secret Manager as `mebelflow-openai-api-key` and grant access only to the API service account.
5. Deploy with concurrency 100 and max scale 20, then run warmup and two-instance contention smoke tests.

## Acceptance

- same-session acquisition returns only one active lease;
- stale release cannot clear a replacement lease;
- usage and tenant cost update in one transaction;
- concurrent provider calls cannot reserve more than the tenant budget;
- failed or abandoned calls return their reservation explicitly or by expiry;
- duplicate idempotency keys do not consume RPM;
- RPM and idempotency state are shared by all instances;
- warmup performs no OpenAI request;
- full typecheck and test suite pass.

## Budget policy

Before a provider call, the gateway reserves the conservative uncached cost of the complete per-session token allowance. Settlement atomically replaces that reservation with actual cost; provider failures cancel it, and abandoned reservations expire after 120 seconds. Near the budget boundary this deliberately prefers an early rejection to an unbilled overshoot.
