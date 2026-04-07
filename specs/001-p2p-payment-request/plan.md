# Implementation Plan: P2P Payment Request

**Branch**: `001-p2p-payment-request` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-p2p-payment-request/spec.md`

## Summary

Build a P2P payment request feature for a consumer fintech app. Users can request money from friends via email, manage requests through a dashboard, fulfill payments via simulation, and handle request expiration. The system uses a Go backend with PostgreSQL and a React 19 + Vite frontend with TailwindCSS/shadcn/ui. All monetary values stored as integer cents, state transitions enforced via explicit FSM, idempotency via client-generated UUIDs, and optimistic locking for concurrency control.

## Technical Context

**Language/Version**: Go 1.22+ (backend), TypeScript 5.x strict mode (frontend)
**Primary Dependencies**: Chi router (backend), React 19 + Vite + React Router (frontend), TailwindCSS, shadcn/ui
**Storage**: PostgreSQL (via sqlc for type-safe queries)
**Testing**: `go test` + testify (backend unit/integration), Vitest (frontend unit), Playwright (E2E with video recording)
**Target Platform**: Web application — Linux server (backend), browser SPA (frontend)
**Project Type**: Web application (separate backend API + frontend SPA)
**Performance Goals**: Request creation <5s, payment fulfillment <5s (incl. 2-3s sim delay), dashboard load <2s for 50 requests, filter/search <1s
**Constraints**: USD only, no real payment processing, mock email auth, no WebSocket/SSE (page-load refresh), no pagination (prototype scope)
**Scale/Scope**: Single-tenant prototype, ~5 screens (login, dashboard, new request, request detail, shareable link view)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Financial Data Integrity | PASS | Amounts stored as integer cents, UUIDv4 for IDs, explicit FSM for state transitions, max $10,000 cap, 2-decimal validation |
| II | Test-After-Every-Step | PASS | go test + testify, Vitest, Playwright with video recording planned per phase |
| III | Responsive-First Design | PASS | Mobile 320px+ and desktop 1024px+, TailwindCSS mobile-first, shadcn/ui with 44px touch targets |
| IV | Static Analysis & Clean Code | PASS | golangci-lint strict config (backend), ESLint + Prettier + TS strict mode (frontend) |
| V | Spec-Driven Development | PASS | Using Spec-Kit workflow, spec.md is source of truth |
| VI | Containerized Development | PASS | Docker Compose planned: PostgreSQL + Go API + Vite dev server |
| VII | Incremental Documentation | PASS | README.md created at init, updated after each phase |
| VIII | Security & Authentication | PASS | Input sanitization, crypto-random shareable tokens, auth middleware (swappable), CSRF protection, rate limiting 10 req/min on mutating endpoints |
| IX | Idempotency & Concurrency | PASS | Client-generated UUID idempotency keys, optimistic locking via version column, HTTP 409 on conflict |

**Gate result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-p2p-payment-request/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (not created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── cmd/
│   └── server/
│       └── main.go           # Entry point
├── internal/
│   ├── config/               # Environment config
│   ├── db/
│   │   ├── migrations/       # SQL migrations
│   │   ├── queries/          # sqlc query files
│   │   └── sqlc/             # Generated Go code
│   ├── handler/              # HTTP handlers (Chi routes)
│   ├── middleware/            # Auth, CSRF, rate-limit, idempotency
│   ├── model/                # Domain types & FSM
│   └── service/              # Business logic layer
├── go.mod
├── go.sum
├── .golangci.yml
└── Dockerfile

frontend/
├── src/
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Shell, nav, responsive wrappers
│   │   └── request/          # Request-specific components
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── NewRequestPage.tsx
│   │   └── RequestDetailPage.tsx
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # API client, utils, formatters
│   ├── types/                # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   └── unit/
├── e2e/
│   └── *.spec.ts             # Playwright tests
├── index.html
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── tailwind.config.ts
├── postcss.config.js
├── playwright.config.ts
├── package.json
└── Dockerfile

docker-compose.yml
.env.example
README.md
```

**Structure Decision**: Web application with separate backend (Go API) and frontend (React SPA). This follows the constitution's technical constraints. The backend uses the `internal/` convention for Go packages. sqlc generates type-safe database code from SQL queries and migrations. The frontend follows standard React + Vite conventions with shadcn/ui component library.

## Complexity Tracking

> No constitution violations — table not required.
