# Data Model: P2P Payment Request

**Phase**: 1 — Design & Contracts
**Date**: 2026-04-08

## Entities

### users

Represents an authenticated person. Created on first login via mock email auth.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() | UUIDv4 |
| `email` | `TEXT` | UNIQUE, NOT NULL | Normalized to lowercase |
| `display_name` | `TEXT` | NOT NULL | Derived from email (part before @) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes**: `UNIQUE(email)`

**Validation Rules**:
- Email must be valid per RFC 5322
- Email normalized to lowercase before storage
- Display name auto-derived: `user@example.com` → `user`

---

### payment_requests

The core domain object. Represents a money request from sender to recipient.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() | UUIDv4 |
| `sender_id` | `UUID` | FK → users(id), NOT NULL | User who created the request |
| `recipient_email` | `TEXT` | NOT NULL | May not have an account yet |
| `recipient_id` | `UUID` | FK → users(id), NULLABLE | Resolved when recipient registers/logs in |
| `amount_minor` | `INTEGER` | NOT NULL, CHECK > 0, CHECK <= 1000000 | Stored as integer minor units, e.g. cents for USD (FR-006). Max 1,000,000 = $10,000 USD; limit is currency-specific and should be configurable if multi-currency is added |
| `note` | `TEXT` | NULLABLE | Optional message, max 500 chars |
| `status` | `TEXT` | NOT NULL, DEFAULT 'pending' | One of: pending, paid, declined, cancelled |
| `share_token` | `TEXT` | UNIQUE, NOT NULL | Cryptographically random, 22-char base64url |
| `version` | `INTEGER` | NOT NULL, DEFAULT 1 | Optimistic locking counter |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | creation + 7 days |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes**:
- `UNIQUE(share_token)` — shareable link lookup
- `INDEX(sender_id, created_at DESC)` — outgoing requests dashboard
- `INDEX(recipient_email, created_at DESC)` — incoming requests (before account resolution)
- `INDEX(recipient_id, created_at DESC)` — incoming requests (after account resolution)
- `INDEX(status)` — status filtering

**Validation Rules**:
- `amount_minor` > 0 AND <= 1,000,000 (= $10,000.00 USD). This limit is currency-specific; multi-currency support would require per-currency max amounts — FR-002
- `recipient_email` must be valid email — FR-003
- `sender_id` user's email != `recipient_email` — FR-004 (enforced at service layer)
- `note` max 500 characters
- `share_token` generated via `crypto/rand` → base64url, 22 chars (128 bits entropy) — FR-005
- `status` restricted to enum values via CHECK constraint
- `expires_at` always set to `created_at + INTERVAL '7 days'` — FR-016

**"Expired" Status Note**: "Expired" is NOT stored in the `status` column. It is derived at query time:
```sql
CASE
  WHEN status = 'pending' AND expires_at < now() THEN 'expired'
  ELSE status
END AS display_status
```

---

### idempotency_keys

Prevents duplicate processing of state-mutating actions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `key` | `TEXT` | NOT NULL | Client-generated UUID |
| `user_id` | `UUID` | FK → users(id), NOT NULL | |
| `method` | `TEXT` | NOT NULL | HTTP method |
| `path` | `TEXT` | NOT NULL | Request path |
| `response_status` | `INTEGER` | NOT NULL | Cached response status |
| `response_body` | `BYTEA` | NULLABLE | Cached response body |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Constraints**: `PRIMARY KEY (key, user_id)`

**Retention**: Purge records older than 24 hours via periodic cleanup.

---

### sessions

Managed by `alexedwards/scs` — table auto-created by scs PostgreSQL store.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `token` | `TEXT` | PK | Session token |
| `data` | `BYTEA` | NOT NULL | Encoded session data |
| `expiry` | `TIMESTAMPTZ` | NOT NULL, INDEX | Session expiry |

---

## Relationships

```
users 1──────N payment_requests (as sender via sender_id)
users 1──────N payment_requests (as recipient via recipient_id, nullable)
users 1──────N idempotency_keys (via user_id)
```

- A user can send many payment requests (outgoing)
- A user can receive many payment requests (incoming)
- `recipient_id` is NULL when the recipient hasn't registered yet; resolved on login by matching `recipient_email`
- On user login: `UPDATE payment_requests SET recipient_id = $1 WHERE recipient_email = $2 AND recipient_id IS NULL`

## State Machine

```
                 ┌──────────────┐
                 │   PENDING    │
                 └──────┬───────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌───────────┐
    │   PAID   │  │ DECLINED │  │ CANCELLED │
    └──────────┘  └──────────┘  └───────────┘
    (recipient)   (recipient)    (sender)

    [EXPIRED] — derived at query time when
    status = 'pending' AND expires_at < now()
```

**Transition Guards** (all enforced in service layer + SQL WHERE):
- `pending → paid`: Only recipient, `expires_at > now()`, `version` match
- `pending → declined`: Only recipient, `expires_at > now()`, `version` match
- `pending → cancelled`: Only sender, `expires_at > now()`, `version` match
- All terminal states (paid, declined, cancelled, expired): No further transitions allowed

**SQL Guard Pattern**:
```sql
UPDATE payment_requests
SET status = $1, version = version + 1, updated_at = now()
WHERE id = $2
  AND status = 'pending'
  AND expires_at > now()
  AND version = $3
RETURNING *;
```
If 0 rows returned: check current state to determine appropriate error (409 Conflict, 410 Gone/expired, 404 Not Found).
