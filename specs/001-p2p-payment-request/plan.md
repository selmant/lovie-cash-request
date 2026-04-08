# Implementation Plan: P2P Payment Request

**Branch**: `001-p2p-payment-request` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-p2p-payment-request/spec.md`

## Summary

P2P payment request feature for a consumer fintech prototype. Users create money requests (with recipient email/phone, amount, optional note), manage them via a dashboard, and recipients can pay/decline. Includes mock auth, request expiration (7-day), idempotency, CSRF, and rate limiting. Built with Go + Chi backend, React 19 + Vite frontend, PostgreSQL storage.

## Technical Context

**Language/Version**: Go 1.22+ (backend), TypeScript 5.x strict mode (frontend)  
**Primary Dependencies**: Chi router, sqlc, goose, scs (backend); React 19, Vite, React Router v7, shadcn/ui, TailwindCSS (frontend)  
**Storage**: PostgreSQL (goose migrations, sqlc code generation)  
**Testing**: `go test` + testify (backend unit/integration), Vitest (frontend unit), Playwright with video (E2E)  
**Linting**: golangci-lint with strict config — errcheck, staticcheck, gosec, govet (backend); ESLint + Prettier, TypeScript strict mode, enforced import ordering (frontend)  
**Target Platform**: Web application — Linux/Docker server (backend), browser SPA (frontend)  
**Project Type**: Web application (API backend + SPA frontend)  
**Deployment**: Docker Compose only — `docker compose up` runs PostgreSQL, Go API, and Vite frontend. No external hosting (Vercel/Fly.io) for this prototype.  
**Performance Goals**: Request creation <5s, dashboard load <2s for 50 requests, filter/search <1s  
**Constraints**: Mobile-first responsive (320px+), dark theme default, prototype scope (no real payments)  
**Scale/Scope**: Single-tenant prototype, ~5 screens (auth, dashboard, new request, detail, shareable link)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Financial Data Integrity | PASS | `amount_minor` stored as integer cents, CHECK > 0 and <= 1000000, FSM validated in data-model.md |
| II | Test-After-Every-Step | PASS | Test strategy defined: go test + testify, Vitest, Playwright with video recording |
| III | Responsive-First Design | PASS | Mobile-first (320px+), 44px touch targets, shadcn/ui components, dark theme default |
| IV | Static Analysis & Clean Code | PASS | golangci-lint strict (backend), ESLint + Prettier + TS strict mode (frontend) |
| V | Spec-Driven Development | PASS | Full spec.md written before planning, all artifacts reference spec requirements |
| VI | Containerized Development | PASS | Docker Compose for PostgreSQL + Go API + Vite dev server in quickstart.md |
| VII | Incremental Documentation | PASS | README.md to be created at project init, updated per phase |
| VIII | Security & Authentication | PASS | CSRF double-submit cookie, crypto/rand share tokens, rate limiting 10 req/min, session-based mock auth |
| IX | Idempotency & Concurrency | PASS | Idempotency key column on payment_requests, status-guard WHERE clause, 409 Conflict on race |

**Pre-Phase 0 Gate**: PASS — no violations.
**Post-Phase 1 Gate**: PASS — all design artifacts (data-model.md, contracts/api.md) align with constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── cmd/server/main.go           # Entry point
├── Dockerfile                   # Multi-stage Go build
├── internal/
│   ├── api/                     # HTTP handlers (Chi routes)
│   │   ├── router.go            # Route definitions + middleware
│   │   ├── auth.go              # Auth handlers (signup, login, logout, me)
│   │   ├── requests.go          # Payment request handlers (CRUD + actions)
│   │   ├── csrf.go              # CSRF token endpoint
│   │   └── middleware.go        # Auth, CSRF, rate-limit middleware
│   ├── config/                  # Env parsing (DATABASE_URL, SESSION_SECRET, PORT, CORS_ORIGIN)
│   ├── db/
│   │   ├── migrations/          # Goose SQL migrations
│   │   ├── queries/             # sqlc SQL query files
│   │   └── store/               # sqlc-generated Go code
│   └── service/                 # Business logic (validation, FSM, idempotency)
├── .golangci.yml                # golangci-lint strict config (errcheck, staticcheck, gosec, govet)
├── sqlc.yaml
├── go.mod
└── go.sum

frontend/
├── src/
│   ├── components/              # Reusable UI components (shadcn/ui)
│   │   └── ui/                  # shadcn/ui primitives
│   ├── hooks/                   # Custom hooks (useAuth, useRequests, etc.)
│   ├── types/                   # Shared TypeScript types (API response shapes, entities)
│   ├── routes/                  # Route-level page components
│   │   ├── auth/                # Login/signup
│   │   ├── dashboard/           # Request list + filters
│   │   ├── new-request/         # Create request form
│   │   └── request-detail/      # Detail view + actions
│   ├── lib/                     # Utilities
│   │   ├── api-client.ts        # Fetch wrapper with CSRF + idempotency
│   │   └── utils.ts             # Formatting, validation helpers
│   ├── App.tsx                  # Router + layout
│   └── main.tsx                 # Entry point
├── Dockerfile                   # Multi-stage Node build (build → nginx serve)
├── e2e/                         # Playwright E2E tests
├── eslint.config.js             # ESLint flat config (strict TS rules, import ordering)
├── .prettierrc                  # Prettier config
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── playwright.config.ts

docker-compose.yml               # PostgreSQL + Go API + Frontend (all services)
.env.example
```

**Structure Decision**: Web application pattern — separate `backend/` (Go API) and `frontend/` (React SPA) directories at repository root. Each service has its own `Dockerfile`. Docker Compose orchestrates all three services (PostgreSQL, backend, frontend) — `docker compose up` is the only command needed to run the full stack.

## Complexity Tracking

> No constitution violations — all gates passed. No justifications needed.
