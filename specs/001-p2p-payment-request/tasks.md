# Tasks: P2P Payment Request

**Input**: Design documents from `/specs/001-p2p-payment-request/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted. E2E setup with Playwright is included in Polish phase per plan.md requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/` (Go API) and `frontend/` (React SPA) at repository root
- **Docker Compose**: `docker-compose.yml` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, tooling, and basic structure

- [X] T001 Create project directory structure per plan.md (`backend/cmd/server/`, `backend/internal/{api,config,db,service}/`, `frontend/src/{components,hooks,types,routes,lib}/`)
- [X] T002 Initialize Go module with dependencies in `backend/go.mod` (chi, sqlc, goose, scs, scs-pgxstore, testify, x/time/rate, x/crypto)
- [X] T003 [P] Initialize frontend with Vite + React 19 + TypeScript strict mode in `frontend/` (pnpm init, vite, react, react-dom, react-router)
- [X] T004 [P] Create `.env.example` at repository root with DATABASE_URL, PORT, SESSION_SECRET, CORS_ORIGIN, ENVIRONMENT
- [X] T005 [P] Configure golangci-lint strict config in `backend/.golangci.yml` (errcheck, staticcheck, gosec, govet)
- [X] T006 [P] Configure ESLint flat config in `frontend/eslint.config.js` and Prettier in `frontend/.prettierrc` with TypeScript strict rules and import ordering
- [X] T007 [P] Setup TailwindCSS v4 and shadcn/ui in `frontend/` (tailwind.config.ts, postcss, cn utility in `frontend/src/lib/utils.ts`)
- [X] T008 [P] Create `docker-compose.yml` at repository root with PostgreSQL, backend (Go), and frontend (Vite) services
- [X] T009 [P] Create `backend/Dockerfile` (multi-stage Go build) and `frontend/Dockerfile` (multi-stage Node build with nginx)
- [X] T010 [P] Add sqlc configuration in `backend/sqlc.yaml` pointing to `internal/db/migrations/` and `internal/db/queries/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T011 Create goose migrations for `users`, `payment_requests`, and `sessions` tables in `backend/internal/db/migrations/` per data-model.md (includes all indexes, CHECK constraints, and derived status CASE WHEN)
- [X] T012 Write sqlc query files in `backend/internal/db/queries/` for base CRUD operations: `users.sql` (create, get by email, get by id) and `requests.sql` (insert with share_token + expires_at, get by id with derived status, get by share_token)
- [X] T013 Run sqlc generate to produce Go code in `backend/internal/db/store/`
- [X] T014 [P] Implement config package in `backend/internal/config/config.go` (parse DATABASE_URL, PORT, SESSION_SECRET, CORS_ORIGIN, ENVIRONMENT from env)
- [X] T015 [P] Implement Go entry point in `backend/cmd/server/main.go` (database connection, session manager init, router setup, graceful shutdown)
- [X] T016 [P] Setup Chi router skeleton with middleware chain in `backend/internal/api/router.go` (CORS, session loading, logging, recovery)
- [X] T017 [P] Implement session manager setup with scs + PostgreSQL store in `backend/internal/api/middleware.go`
- [X] T018 [P] Implement CSRF double-submit cookie middleware and GET /api/csrf endpoint in `backend/internal/api/csrf.go`
- [X] T019 [P] Implement rate limiting middleware (golang.org/x/time/rate, per-user map, 10 req/min) in `backend/internal/api/middleware.go`
- [X] T020 [P] Implement common JSON response helpers (success, error with codes, validation errors with details) in `backend/internal/api/response.go`
- [X] T021 [P] Create frontend API client (fetch wrapper with credentials:include, CSRF token from cookie, Idempotency-Key header) in `frontend/src/lib/api-client.ts`
- [X] T022 [P] Setup React Router v7 with createBrowserRouter, layout routes, and placeholder pages in `frontend/src/App.tsx` and `frontend/src/main.tsx`
- [X] T023 [P] Define shared TypeScript types (User, PaymentRequest, API response shapes, error codes) in `frontend/src/types/index.ts`
- [X] T024 [P] Install shadcn/ui base components: Button, Input, Label, Card, Skeleton, Sonner (toast), Tabs, Badge, Select, AlertDialog, Table in `frontend/src/components/ui/`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 5 - User Authentication (Priority: P1) MVP

**Goal**: Users can sign up with email + optional phone, log in, log out, and maintain sessions. All other pages require auth.

**Independent Test**: Sign up as alice@example.com with phone +14155551111, log out, log back in with same email, verify redirect to dashboard and session persistence.

### Implementation for User Story 5

- [X] T025 [P] [US5] Add sqlc queries for user lookup by email, phone, and id; user creation; bulk recipient resolution (UPDATE payment_requests SET recipient_id WHERE recipient_email/phone match) in `backend/internal/db/queries/users.sql`
- [X] T026 [US5] Implement auth service in `backend/internal/service/auth.go` (signup with email validation + phone E.164 validation, login by email, session create/destroy, recipient resolution on login)
- [X] T027 [US5] Implement auth HTTP handlers in `backend/internal/api/auth.go` (POST /api/auth/signup, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me per contracts/api.md)
- [X] T028 [US5] Implement auth middleware (require-auth, inject user into context) in `backend/internal/api/middleware.go`
- [X] T029 [P] [US5] Create useAuth hook with context provider in `frontend/src/hooks/useAuth.ts` (GET /api/auth/me on mount, signup, login, logout methods)
- [X] T030 [US5] Create auth page with email + phone fields, "Log in" and "Sign up" buttons, inline validation in `frontend/src/routes/auth/AuthPage.tsx`
- [X] T031 [US5] Create AuthLayout wrapper that checks auth state, redirects to /login?redirect=<path> if unauthenticated in `frontend/src/routes/auth/AuthLayout.tsx`
- [X] T032 [US5] Create persistent app header with nav links (Dashboard, New Request), theme toggle placeholder, and logout button showing user email in `frontend/src/components/Header.tsx`

**Checkpoint**: Auth works end-to-end. Users can sign up, log in, log out. All routes behind auth guard.

---

## Phase 4: User Story 1 - Create and View a Payment Request (Priority: P1)

**Goal**: Users can create payment requests with recipient email/phone, amount, and optional note. System generates shareable link. Request appears in outgoing list.

**Independent Test**: Create a request for bob@example.com, $25.00, note "Lunch". Verify it appears in outgoing list with status "Pending" and a valid shareable link.

### Implementation for User Story 1

- [ ] T033 [P] [US1] Add sqlc queries for payment request creation (INSERT with share_token, expires_at = created_at + 7 days) and retrieval by share_token in `backend/internal/db/queries/requests.sql`
- [ ] T034 [US1] Implement request service in `backend/internal/service/requests.go` (create with validation: amount >0 and <=1000000 cents, max 2 decimal places, email/phone format, self-request prevention FR-004, share_token generation via crypto/rand base64url 22 chars, note max 500 chars)
- [ ] T035 [US1] Implement request HTTP handlers in `backend/internal/api/requests.go` (POST /api/requests, GET /api/requests/{id}, GET /api/requests/by-token/{share_token} with sender/recipient auth check per contracts/api.md)
- [ ] T036 [P] [US1] Create New Request page with form (recipient input with auto-detect email vs phone, amount input with $ prefix, note textarea with 500 char counter) in `frontend/src/routes/new-request/NewRequestPage.tsx`
- [ ] T037 [US1] Create Request Detail page (amount, note, sender/recipient info, status badge, shareable link in read-only field with Copy button, skeleton loading) in `frontend/src/routes/request-detail/RequestDetailPage.tsx`
- [ ] T038 [US1] Create shareable link route that resolves /r/{token} via GET /api/requests/by-token/{token} and redirects to detail view in `frontend/src/routes/request-detail/ShareRoute.tsx`
- [ ] T039 [US1] Wire New Request and Detail routes into React Router in `frontend/src/App.tsx`

**Checkpoint**: Users can create requests, view them, and share links. Shareable links work for sender and recipient (redirects to login if unauthenticated, 403 for unauthorized users).

---

## Phase 5: User Story 2 - Pay, Decline, or Cancel a Request (Priority: P2)

**Goal**: Recipients can pay (with simulated delay) or decline incoming requests. Senders can cancel outgoing requests. Idempotency prevents duplicate processing. Concurrent mutations return 409.

**Independent Test**: Create a request between two users. Recipient pays it. Verify status updates to "Paid" on both sender's outgoing and recipient's incoming views.

### Implementation for User Story 2

- [ ] T040 [P] [US2] Add sqlc queries for status transitions (UPDATE with WHERE status='pending' AND expires_at > now(), idempotency_key check) and idempotency lookup in `backend/internal/db/queries/requests.sql`
- [ ] T041 [US2] Implement action service in `backend/internal/service/actions.go` (pay with 2-3s simulated delay, decline, cancel; role checks — recipient for pay/decline, sender for cancel; idempotency check — if key matches return current state, else 409; expiration check before mutation)
- [ ] T042 [US2] Implement action HTTP handlers in `backend/internal/api/requests.go` (POST /api/requests/{id}/pay, POST /api/requests/{id}/decline, POST /api/requests/{id}/cancel with Idempotency-Key header required, rate limiting applied)
- [ ] T043 [US2] Add action buttons to Request Detail page: Pay and Decline for pending incoming requests, Cancel for pending outgoing requests, no buttons for terminal states in `frontend/src/routes/request-detail/RequestDetailPage.tsx`
- [ ] T044 [US2] Add confirmation dialogs (AlertDialog) for Pay and Cancel actions; Decline executes immediately (FR-029) in `frontend/src/routes/request-detail/RequestDetailPage.tsx`
- [ ] T045 [US2] Add toast notifications for action success/failure (Sonner), loading state for Pay (2-3s), error handling for 409 Conflict and 429 Rate Limit in `frontend/src/routes/request-detail/RequestDetailPage.tsx`

**Checkpoint**: Full request lifecycle works. Pay shows loading simulation, decline is instant, cancel works for sender. Idempotency prevents double-processing. Concurrent conflicts shown as toast.

---

## Phase 6: User Story 3 - Dashboard with Filters and Search (Priority: P3)

**Goal**: Dashboard shows outgoing and incoming requests in tabs. Users can filter by status and search by counterparty email/phone. Sorted by creation date descending.

**Independent Test**: Seed several requests with different statuses. Filter by "Pending" — only pending requests shown. Search by email — results narrow correctly.

### Implementation for User Story 3

- [ ] T046 [P] [US3] Add sqlc queries for listing requests with filters (direction outgoing/incoming, status filter, search partial match on counterparty email/phone, ORDER BY created_at DESC) in `backend/internal/db/queries/requests.sql`
- [ ] T047 [US3] Implement list service in `backend/internal/service/requests.go` (build filtered query, derive expired status for pending requests with expires_at < now())
- [ ] T048 [US3] Implement list HTTP handler (GET /api/requests with query params: direction, status, search per contracts/api.md) in `backend/internal/api/requests.go`
- [ ] T049 [US3] Create Dashboard page with Outgoing/Incoming tabs (shadcn Tabs), request table with columns (recipient/sender, amount, status badge, date, link to detail), skeleton loading in `frontend/src/routes/dashboard/DashboardPage.tsx`
- [ ] T050 [US3] Add status filter dropdown (shadcn Select: All, Pending, Paid, Declined, Expired, Cancelled) and search input (partial email/phone match) to dashboard in `frontend/src/routes/dashboard/DashboardPage.tsx`
- [ ] T051 [US3] Add empty state message "No requests match your filters" and mobile-responsive single-column layout in `frontend/src/routes/dashboard/DashboardPage.tsx`
- [ ] T052 [US3] Wire Dashboard as the default authenticated route (/) in `frontend/src/App.tsx`

**Checkpoint**: Dashboard fully functional with tabs, filters, and search. Mobile responsive. Empty states handled.

---

## Phase 7: User Story 4 - Request Expiration (Priority: P4)

**Goal**: Pending requests older than 7 days display as "Expired" (derived at query time). Expiration countdown shown on pending request detail. Expired requests cannot be acted upon.

**Independent Test**: Seed a request with expires_at in the past. Verify status shows "Expired", no action buttons displayed, and Pay attempt returns error.

### Implementation for User Story 4

- [ ] T053 [US4] Verify and refine expiration derivation in all sqlc queries (CASE WHEN status='pending' AND expires_at < now() THEN 'expired' ELSE status END) in `backend/internal/db/queries/requests.sql`
- [ ] T054 [US4] Verify expiration guard in action service — confirm pay/decline/cancel check expires_at > now() before mutation, return 410 Gone if expired in `backend/internal/service/actions.go`
- [ ] T055 [US4] Add expiration countdown component to Request Detail page (days when >24h, hours+minutes when <24h, "Expired" badge when past) in `frontend/src/routes/request-detail/RequestDetailPage.tsx`
- [ ] T056 [US4] Ensure expired requests show no action buttons and display "This request has expired" on attempted actions via shareable link in `frontend/src/routes/request-detail/RequestDetailPage.tsx`

**Checkpoint**: Expiration works end-to-end. Countdown displays correctly. Expired requests are fully locked.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T057 [P] Implement dark theme default with light/dark toggle (localStorage persistence) in `frontend/src/components/Header.tsx` and `frontend/src/lib/theme.ts` (FR-021a)
- [ ] T058 [P] Ensure mobile-responsive layout across all pages (320px+ viewport, 44px touch targets, single-column on mobile) (FR-021)
- [ ] T059 [P] Add skeleton loading states (shadcn Skeleton) to Dashboard tables, Request Detail, and auth check loading in relevant route components (FR-028)
- [ ] T060 [P] Setup Playwright config with video recording in `frontend/playwright.config.ts` and `frontend/e2e/` directory structure
- [ ] T061 [P] Create README.md with project overview, quickstart instructions, and multi-user testing guide at repository root
- [ ] T062 Run `docker compose up` validation — verify all services start, migrations run, frontend proxies to backend, full user flow works end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **US5 Auth (Phase 3)**: Depends on Foundational - BLOCKS all other user stories (auth is prerequisite)
- **US1 Create/View (Phase 4)**: Depends on US5 Auth
- **US2 Pay/Decline/Cancel (Phase 5)**: Depends on US1 (needs requests to exist)
- **US3 Dashboard (Phase 6)**: Depends on US1 (needs requests to list); can partially parallel with US2
- **US4 Expiration (Phase 7)**: Depends on US1 and US2 (refines existing behavior)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US5 (P1 Auth)**: Blocks everything — must complete first after Foundational
- **US1 (P1 Create/View)**: Depends on US5 — core request creation
- **US2 (P2 Pay/Decline/Cancel)**: Depends on US1 — needs existing requests
- **US3 (P3 Dashboard)**: Depends on US1 — needs requests to list; could start after US1 in parallel with US2
- **US4 (P4 Expiration)**: Depends on US1+US2 — refines query-time status and guards

### Within Each User Story

- sqlc queries before services
- Services before HTTP handlers
- Backend before frontend (frontend needs API to call)
- Core components before integration/wiring

### Parallel Opportunities

- All [P] Setup tasks (T003-T010) can run in parallel after T001-T002
- All [P] Foundational tasks (T014-T024) can run in parallel after T011-T013
- Backend and frontend [P] tasks within each user story can run in parallel
- US3 (Dashboard) can start in parallel with US2 once US1 is complete

---

## Parallel Example: Phase 2 Foundational

```bash
# After T011-T013 (migrations + sqlc setup), launch in parallel:
Task T014: "Config package in backend/internal/config/config.go"
Task T015: "Main entry point in backend/cmd/server/main.go"
Task T016: "Chi router skeleton in backend/internal/api/router.go"
Task T017: "Session manager in backend/internal/api/middleware.go"
Task T018: "CSRF middleware in backend/internal/api/csrf.go"
Task T019: "Rate limiting in backend/internal/api/middleware.go"  # same file as T017, sequence after T017
Task T020: "Response helpers in backend/internal/api/response.go"
Task T021: "Frontend API client in frontend/src/lib/api-client.ts"
Task T022: "React Router setup in frontend/src/App.tsx"
Task T023: "TypeScript types in frontend/src/types/index.ts"
Task T024: "shadcn/ui components in frontend/src/components/ui/"
```

## Parallel Example: US1 Create/View

```bash
# After T033 (sqlc queries), launch in parallel:
Task T034: "Request service in backend/internal/service/requests.go"
Task T036: "New Request page in frontend/src/routes/new-request/NewRequestPage.tsx"

# After T034 completes:
Task T035: "Request handlers in backend/internal/api/requests.go"

# After T035 + T036 complete:
Task T037: "Request Detail page in frontend/src/routes/request-detail/RequestDetailPage.tsx"
Task T038: "Share route in frontend/src/routes/request-detail/ShareRoute.tsx"
Task T039: "Wire routes in frontend/src/App.tsx"
```

---

## Implementation Strategy

### MVP First (US5 Auth + US1 Create/View)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: US5 Auth
4. Complete Phase 4: US1 Create and View Request
5. **STOP and VALIDATE**: Two users can sign up, create requests, view details, share links
6. Deploy/demo if ready — this is a functional MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US5 Auth → Users can authenticate → First milestone
3. Add US1 Create/View → Test independently → Deploy/Demo (**MVP!**)
4. Add US2 Pay/Decline/Cancel → Test independently → Deploy/Demo
5. Add US3 Dashboard → Test independently → Deploy/Demo
6. Add US4 Expiration → Test independently → Deploy/Demo
7. Polish → Final deploy

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Amount always stored as integer cents (amount_minor) — conversion at API boundary
- "Expired" status is never stored — derived at query time via CASE WHEN
- Idempotency key stored on payment_requests row, checked during transitions
