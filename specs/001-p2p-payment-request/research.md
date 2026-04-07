# Research: P2P Payment Request

**Phase**: 0 — Outline & Research
**Date**: 2026-04-08

## Backend Decisions

### 1. Database Migrations — goose

- **Decision**: Use goose for SQL migrations
- **Rationale**: Plain SQL migration files with `-- +goose Up/Down` markers. Integrates cleanly with sqlc — sqlc can parse goose-annotated files directly as schema source. Supports `embed.FS` for single-binary deploys.
- **Alternatives considered**: golang-migrate (more complex versioning, less clean sqlc integration), atlas

### 2. sqlc Code Generation

- **Decision**: Use sqlc with PostgreSQL for type-safe query generation
- **Rationale**: Write SQL queries with annotations in `queries/` dir, sqlc generates Go structs and functions. Schema sourced from migration files. Zero runtime overhead — all generation happens at build time.
- **Configuration**: `sqlc.yaml` at backend root, pointing to `internal/db/queries/` and `internal/db/migrations/`

### 3. Idempotency — Column on payment_requests

- **Decision**: Store `idempotency_key` directly on the `payment_requests` row, set during the terminal state transition
- **Rationale**: Only one mutation can ever succeed per request (FSM guarantees pending → single terminal state). A single column is sufficient — no separate table, no cleanup goroutine, no response caching middleware. On duplicate request: if `idempotency_key` matches, return current state as success; otherwise 409.
- **Alternatives considered**: Separate `idempotency_keys` table with response caching (overkill for 3 actions on one entity), Redis-based store (unnecessary complexity)

### 4. Optimistic Locking — Version Column

- **Decision**: `version INT NOT NULL DEFAULT 1` column on `payment_requests`
- **Query pattern**: `UPDATE payment_requests SET status = $1, version = version + 1, updated_at = now() WHERE id = $2 AND version = $3 RETURNING *`
- **Rationale**: Check rows affected == 0 to detect conflicts, return HTTP 409. sqlc's RETURNING maps cleanly to generated Go structs. Simplest OCC pattern.
- **Alternatives considered**: `updated_at`-based OCC (timestamp precision issues), `SELECT ... FOR UPDATE` (heavier, unnecessary)

### 5. CSRF Protection — Double-Submit Cookie

- **Decision**: Double-submit cookie pattern
- **Mechanism**: Go API sets `HttpOnly=false` CSRF cookie. React SPA reads it via JS and sends back as `X-CSRF-Token` header. Middleware compares cookie value to header value.
- **Rationale**: Stateless — no server-side token storage. Works naturally with SPA + API architecture.
- **Alternatives considered**: Synchronizer token pattern (requires session-stored token), SameSite cookie alone (insufficient per OWASP)

### 6. Rate Limiting — In-Memory Token Bucket

- **Decision**: `golang.org/x/time/rate` with per-user map
- **Rationale**: No Redis dependency for prototype. stdlib-adjacent, proven token-bucket algorithm. 10 req/min per authenticated user on payment-mutating endpoints.
- **Alternatives considered**: Redis-based (`go-redis/redis_rate`) — overkill, tollbooth (convenience wrapper, less control)

### 7. Session Management — alexedwards/scs

- **Decision**: `alexedwards/scs` v2 with PostgreSQL store
- **Rationale**: Actively maintained, idiomatic `context.Context` usage, works as Chi middleware via `r.Use(sessionManager.LoadAndSave)`. Supports multiple backends. Cleaner API than gorilla/sessions.
- **Alternatives considered**: gorilla/sessions (archived, cookie-store-centric), hand-rolled JWT (more complexity for mock auth)

## Frontend Decisions

### 8. Routing — React Router v7 (SPA Mode)

- **Decision**: `react-router` with `createBrowserRouter` in SPA mode
- **Auth pattern**: `<AuthLayout>` wrapper component checks session status, redirects to `/login?redirect=<current_path>`. On login success, read `searchParams.get("redirect")` and navigate.
- **Rationale**: Classic SPA setup is lighter than framework mode. Layout routes are idiomatic for route guarding.
- **Alternatives considered**: TanStack Router (heavier learning curve), React Router framework mode (adds SSR complexity)

### 9. shadcn/ui Components

- **Decision**: Use the following components:
  - **Forms**: `Button`, `Input`, `Label`, `Form` (react-hook-form integration)
  - **Dashboard**: `Table`, `Tabs`, `Badge` (status labels), `Select` (filters)
  - **Feedback**: `Dialog`, `AlertDialog`, `Sonner` (toast notifications)
  - **Layout**: `Card`, `Skeleton` (loading states), `DropdownMenu` (actions)
- **Rationale**: Direct mapping to feature requirements. All available as copy-paste Radix UI primitives.

### 10. API Client — Native Fetch Wrapper

- **Decision**: Thin `fetch` wrapper (~40 lines) in `lib/api-client.ts`
- **Configuration**: `credentials: "include"` for cookie-based auth. Read CSRF token from cookie, attach as `X-CSRF-Token` header. Add `Idempotency-Key` header (UUID v4) on mutating requests.
- **Rationale**: No extra dependencies. Modern TypeScript generics for typed responses. Consistent error handling and header injection.
- **Alternatives considered**: Axios (larger bundle, no real benefit), Ky (nice API but extra dependency)

### 11. E2E Testing — Playwright with Video

- **Decision**: Playwright with `video: "on"` in config
- **Key config**: `use: { video: "on" }` in `playwright.config.ts`. Videos saved per-test in `test-results/`. Optional `video: { mode: "on", size: { width: 1280, height: 720 } }` for consistent sizing. `trace: "retain-on-failure"` for debugging.
- **Rationale**: `"on"` keeps all recordings — needed for submission demo. Playwright is the specified E2E tool.
- **Alternatives considered**: Cypress (heavier), OS-level screen capture (fragile)
