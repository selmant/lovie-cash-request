# API Contracts: P2P Payment Request

**Base URL**: `/api`
**Content-Type**: `application/json`
**Auth**: Session cookie (set by login endpoint)
**CSRF**: `X-CSRF-Token` header required on all state-changing endpoints

## Common Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Cookie` | All requests | Session cookie (automatic) |
| `X-CSRF-Token` | State-changing | CSRF double-submit token |
| `Idempotency-Key` | Pay/Decline/Cancel | Client-generated UUID v4 |

## Common Error Response

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

Error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `EXPIRED`, `RATE_LIMITED`, `INTERNAL_ERROR`

---

## Authentication

### POST /api/auth/login

Create a session via mock email auth.

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response 200**:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": null,
    "display_name": "user",
    "created_at": "2026-04-08T00:00:00Z"
  }
}
```
Sets session cookie + CSRF cookie.

**Response 400**: Invalid email format.

### POST /api/auth/logout

Destroy the current session.

**Response 200**:
```json
{ "message": "Logged out" }
```

### GET /api/auth/me

Get current authenticated user.

**Response 200**:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "+14155551234",
    "display_name": "user",
    "created_at": "2026-04-08T00:00:00Z"
  }
}
```

**Response 401**: Not authenticated.

---

## Payment Requests

### POST /api/requests

Create a new payment request.

**Request**:
```json
{
  "recipient_email": "friend@example.com",
  "recipient_phone": "+14155551234",
  "amount": "25.00",
  "note": "Dinner last night"
}
```

- `recipient_email`: Optional if `recipient_phone` provided. At least one required.
- `recipient_phone`: Optional if `recipient_email` provided. E.164 format.
- `amount`: String with exactly 2 decimal places. Converted to minor units (cents) server-side.
- `note`: Optional, max 500 characters.

**Response 201**:
```json
{
  "request": {
    "id": "uuid",
    "sender": {
      "id": "uuid",
      "email": "user@example.com",
      "display_name": "user"
    },
    "recipient_email": "friend@example.com",
    "recipient_phone": "+14155551234",
    "recipient": null,
    "amount_minor": 2500,
    "amount_display": "$25.00",
    "note": "Dinner last night",
    "status": "pending",
    "share_token": "abc123def456",
    "share_url": "/r/abc123def456",
    "expires_at": "2026-04-15T00:00:00Z",
    "created_at": "2026-04-08T00:00:00Z",
  }
}
```

**Response 400**: Validation errors.
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "amount": "Amount must be between $0.01 and $10,000.00 (USD limit; currency-specific if multi-currency added)",
    "recipient_email": "Invalid email format",
    "recipient_phone": "Invalid phone format (must be E.164, e.g. +14155551234)"
  }
}
```

**Response 422**: Self-request.
```json
{
  "error": "You cannot request money from yourself",
  "code": "VALIDATION_ERROR"
}
```

### GET /api/requests

List payment requests for the authenticated user.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `direction` | `outgoing` \| `incoming` | `outgoing` | Filter by sent/received |
| `status` | `pending` \| `paid` \| `declined` \| `expired` \| `cancelled` | all | Filter by status |
| `search` | string | — | Partial email or phone match on counterparty |

**Response 200**:
```json
{
  "requests": [
    {
      "id": "uuid",
      "sender": { "id": "uuid", "email": "...", "display_name": "..." },
      "recipient_email": "friend@example.com",
      "recipient_phone": "+14155551234",
      "recipient": { "id": "uuid", "email": "...", "phone": "...", "display_name": "..." },
      "amount_minor": 2500,
      "amount_display": "$25.00",
      "note": "Dinner last night",
      "status": "pending",
      "share_token": "abc123def456",
      "share_url": "/r/abc123def456",
      "expires_at": "2026-04-15T00:00:00Z",
      "created_at": "2026-04-08T00:00:00Z",
      }
  ]
}
```

Note: `status` field returns `"expired"` for pending requests where `expires_at < now()` (derived at query time).

### GET /api/requests/{id}

Get a single payment request by ID.

**Response 200**: Same shape as single item in list response, wrapped in `{ "request": { ... } }`.

**Response 403**: User is neither sender nor recipient.
```json
{
  "error": "Not authorized to view this request",
  "code": "FORBIDDEN"
}
```

**Response 404**: Request not found.

### GET /api/requests/by-token/{share_token}

Get a payment request by its shareable token.

**Response 200**: Same as GET /api/requests/{id}.

**Response 403**: User is neither sender nor recipient.

**Response 404**: Token not found.

### POST /api/requests/{id}/pay

Pay a pending incoming request. Simulates 2-3 second processing delay.

**Headers**: `Idempotency-Key: <uuid>` (required)

**Response 200**:
```json
{
  "request": {
    "...": "full request object with status: paid"
  }
}
```

**Response 403**: User is not the recipient.

**Response 409**: Concurrent modification (already actioned by another party).
```json
{
  "error": "Request has already been modified. Please refresh.",
  "code": "CONFLICT"
}
```

**Response 410**: Request has expired.
```json
{
  "error": "This request has expired",
  "code": "EXPIRED"
}
```

**Response 429**: Rate limit exceeded.

### POST /api/requests/{id}/decline

Decline a pending incoming request.

**Headers**: `Idempotency-Key: <uuid>` (required)

**Response 200**: Full request object with `status: "declined"`.

**Response 403/409/410/429**: Same as pay endpoint.

### POST /api/requests/{id}/cancel

Cancel a pending outgoing request (sender only).

**Headers**: `Idempotency-Key: <uuid>` (required)

**Response 200**: Full request object with `status: "cancelled"`.

**Response 403**: User is not the sender.

**Response 409/410/429**: Same as pay endpoint.

---

## CSRF

### GET /api/csrf

Get a fresh CSRF token. Called on app init.

**Response 200**:
```json
{
  "token": "csrf-token-value"
}
```
Also sets `csrf_token` cookie (`HttpOnly=false`, `SameSite=Strict`, `Secure` in production).
