# Cash Request

P2P payment request prototype. Users create money requests, share links, and recipients can pay or decline.

## Quick Start

```bash
cp .env.example .env
docker compose up
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080

## Local Development

### Database
```bash
docker compose up db
```

### Backend
```bash
cd backend
go mod download
go run cmd/server/main.go
```

### Frontend
```bash
cd frontend
pnpm install
pnpm dev
```

## Multi-User Testing

Auth is mock (no password):
1. Tab 1: Sign up as `alice@example.com` with phone `+14155551111`
2. Tab 2 (incognito): Sign up as `bob@example.com` with phone `+14155552222`
3. Alice creates a request for `bob@example.com`
4. Bob sees it in his incoming requests and can pay/decline

## Tech Stack

- **Backend**: Go 1.26.1+, Chi router, sqlc, goose, scs sessions
- **Frontend**: React 19, Vite, TypeScript strict, TailwindCSS v4, shadcn/ui
- **Database**: PostgreSQL 16
- **Deployment**: Docker Compose

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/cash_request?sslmode=disable` | PostgreSQL connection |
| `PORT` | `8080` | Backend API port |
| `SESSION_SECRET` | (required) | Session cookie signing secret |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin for CORS |
| `ENVIRONMENT` | `development` | `development` or `production` |
