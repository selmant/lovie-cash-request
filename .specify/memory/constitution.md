<!--
  ============================================================
  SYNC IMPACT REPORT
  ============================================================
  Version change: 1.1.0 → 1.1.1 (PATCH — frontend changed
  from Next.js to React + Vite)

  Modified principles: None (stack change only affects
  Technical Constraints section)

  Added sections: None
  Removed sections: None

  Technical Constraints: Frontend changed from Next.js
  (App Router) to React 19 + Vite + React Router.

  Templates requiring updates:
    - .specify/templates/plan-template.md — ⚠ pending
      (Constitution Check needs project-specific gates)
    - .specify/templates/spec-template.md — ✅ compatible
    - .specify/templates/tasks-template.md — ✅ compatible

  Follow-up TODOs: None
  ============================================================
-->

# Cash Request Constitution

## Core Principles

### I. Financial Data Integrity

All monetary amounts MUST be stored and transmitted as integer
cents (minor currency units) to eliminate floating-point precision
errors. Display formatting converts cents to decimal only at the
presentation layer. Amount validation MUST enforce: value > 0,
maximum cap of 10,000.00 USD (1,000,000 cents), and two-decimal
precision on user input. Request IDs MUST be globally unique
(UUIDv4). All state transitions (Pending -> Paid, Pending ->
Declined, Pending -> Expired, Pending -> Cancelled) MUST be
validated against an explicit finite state machine — invalid
transitions MUST return an error, never silently succeed.

### II. Test-After-Every-Step

Every completed task/phase MUST be followed by running the
relevant test suite before proceeding to the next task. Test
output MUST be kept concise (summary + failure details only) to
minimize token consumption in AI-assisted workflows. Test types
include: unit tests for business logic (`go test` for backend,
Vitest for frontend), integration tests for API endpoints, and
E2E tests (Playwright) for critical user journeys. E2E tests
MUST produce automated screen recordings for submission.

### III. Responsive-First Design

The application MUST function on both mobile (320px+) and desktop
(1024px+) viewports as a web application. UI components MUST use
a mobile-first responsive approach. Touch targets MUST meet 44px
minimum size on mobile. All interactive flows (create request,
pay, decline, cancel) MUST be usable on both form factors without
horizontal scrolling.

### IV. Static Analysis & Clean Code

**Backend (Go)**: The project MUST use `golangci-lint` with a
strict configuration (including `errcheck`, `staticcheck`,
`gosec`, `govet`). All exported functions MUST have doc comments.
Error handling MUST be explicit — no ignored errors.

**Frontend (TypeScript)**: The project MUST use ESLint and
Prettier for linting and formatting. TypeScript strict mode MUST
be enabled. No `any` types unless explicitly justified. Import
ordering MUST be enforced automatically.

All code MUST pass lint checks before commit (enforced via
pre-commit hooks or CI).

### V. Spec-Driven Development

All features MUST originate from a written specification (using
GitHub Spec-Kit workflow) before implementation begins. Specs
serve as the source of truth. Implementation MUST NOT deviate
from the spec without updating the spec first. Task breakdown
MUST reference spec requirements for traceability.

### VI. Containerized Development

The project MUST provide a Docker Compose configuration for
local development that includes all runtime dependencies
(database, backend API, frontend dev server). `docker compose up`
MUST be sufficient to start the full development environment.
Environment variables MUST be documented in `.env.example`.

### VII. Incremental Documentation

The project README.md MUST be created at project initialization
and updated after every completed phase/task. README MUST include:
project overview, live demo URL (when available), local setup
instructions, how to run tests, tech stack, and AI tools used.

### VIII. Security & Authentication

All user input MUST be sanitized and validated at the API
boundary before reaching business logic. Shareable request links
MUST use cryptographically random tokens (not sequential or
guessable IDs). Payment-mutating endpoints (pay, decline, cancel)
MUST verify the authenticated user is an authorized party to the
request. CSRF protection MUST be enabled for all state-changing
operations. Rate limiting MUST be applied to payment-mutating
endpoints to prevent abuse (minimum: 10 req/min per user).
Authentication uses simple email-based mock auth (session-based),
but the middleware pattern MUST be structured so a real auth
provider can replace it without changing business logic.

### IX. Idempotency & Concurrency

Every payment-mutating operation (pay, decline, cancel) MUST be
idempotent — repeating the same request with the same idempotency
key MUST return the same result without side effects. The "Pay"
action MUST use an idempotency key (client-generated UUID) sent
in the request header. State transitions MUST use optimistic
locking (version column or `WHERE status = 'pending'` guard) to
prevent race conditions when two users or duplicate requests
attempt to mutate the same payment request simultaneously. If a
concurrent conflict is detected, the API MUST return HTTP 409
Conflict with a clear error message.

## Technical Constraints

- **Backend**: Go 1.26+, Chi router (or stdlib `net/http`),
  PostgreSQL, sqlc or GORM for data access
- **Frontend**: TypeScript, React 19 + Vite, React Router,
  TailwindCSS, shadcn/ui
- **Auth**: Simple email-based mock authentication (session/JWT)
- **Testing**: `go test` + testify (backend), Vitest (frontend
  unit), Playwright (E2E with video recording)
- **Linting**: golangci-lint (backend), ESLint + Prettier
  (frontend), TypeScript strict mode
- **Container**: Docker Compose (PostgreSQL + Go API + Vite dev
  server)
- **Deployment**: Vercel/Netlify (frontend SPA), Fly.io or
  Railway (backend), Docker Compose (local dev)
- **Expiration**: Payment requests expire after 7 days; enforced
  via database query + optional cron/scheduled check

## Development Workflow

1. **Spec Phase**: Write feature spec using Spec-Kit templates
2. **Plan Phase**: Generate implementation plan with technical
   context, constitution check, and project structure
3. **Task Phase**: Break plan into ordered tasks grouped by user
   story with parallel execution markers
4. **Build Phase**: Implement tasks sequentially by priority
   (P1 first), running tests after each task completion
5. **Verify Phase**: Run full test suite (unit + integration +
   E2E), capture screen recordings, lint check
6. **Document Phase**: Update README.md with current state
7. **Deploy Phase**: Deploy frontend + backend, verify live URL

Each phase produces artifacts in `.specify/` and commits are
made after each logical task group. Code review (self or AI)
occurs before merging to main.

## Governance

This constitution is the authoritative source for project
standards and non-negotiable practices. All implementation
decisions MUST comply with the principles above.

- **Amendments**: Any principle change MUST be documented with
  rationale, version-bumped, and propagated to dependent
  templates via the Sync Impact Report.
- **Versioning**: MAJOR for principle removal/redefinition,
  MINOR for new principles or material expansion, PATCH for
  clarifications and wording fixes.
- **Compliance Review**: Each task completion MUST be verified
  against relevant principles before marking complete. The
  Constitution Check section in plan.md MUST reference these
  principles by number.

**Version**: 1.1.1 | **Ratified**: 2026-04-08 | **Last Amended**: 2026-04-08
