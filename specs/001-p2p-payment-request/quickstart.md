# Quickstart: P2P Payment Request

## Prerequisites

- Docker & Docker Compose
- Go 1.26.1+ (for local backend development without Docker)
- Node.js 20+ (for local frontend development without Docker)
- pnpm (frontend package manager)

## Quick Start (Docker Compose)

```bash
# Clone and enter the repo
git clone <repo-url>
cd cash_request

# Copy environment file
cp .env.example .env

# Start all services (PostgreSQL + Go API + Vite dev server)
docker compose up

# App available at:
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080
```

## Local Development (without Docker)

### Database

```bash
# Start PostgreSQL (or use Docker for just the DB)
docker compose up db

# Or use a local PostgreSQL instance and update .env
```

### Backend

```bash
cd backend

# Install dependencies
go mod download

# Install tools
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest

# Run migrations
goose -dir internal/db/migrations postgres "$DATABASE_URL" up

# Generate sqlc code (after writing/modifying queries)
sqlc generate

# Run the server
go run cmd/server/main.go
# API available at http://localhost:8080
```

### Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Start dev server
pnpm dev
# App available at http://localhost:5173
```

## Environment Variables

See `.env.example` for all required variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/cash_request?sslmode=disable` | PostgreSQL connection string |
| `PORT` | `8080` | Backend API port |
| `SESSION_SECRET` | (generate) | Secret for session cookie signing |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin for CORS |
| `ENVIRONMENT` | `development` | `development` or `production` |

## Running Tests

### Backend

```bash
cd backend
go test ./... -v
```

### Frontend Unit Tests

```bash
cd frontend
pnpm test
```

### E2E Tests (Playwright)

```bash
cd frontend

# Install Playwright browsers (first time)
pnpm exec playwright install --with-deps

# Run E2E tests (requires backend + frontend running)
pnpm test:e2e

# Run with video recording
pnpm test:e2e -- --video on
```

## Linting

```bash
# Backend
cd backend
golangci-lint run

# Frontend
cd frontend
pnpm lint
pnpm format:check
```

## Multi-User Testing

Since auth is mock (no password):
1. Open browser tab 1 → sign up as `alice@example.com` with phone `+14155551111`
2. Open browser tab 2 (incognito) → sign up as `bob@example.com` with phone `+14155552222`
3. Alice creates a request for `bob@example.com` (or `+14155552222`)
4. Bob sees the request in his incoming list
