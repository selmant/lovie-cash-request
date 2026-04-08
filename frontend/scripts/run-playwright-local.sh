#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_PID=""

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi
}

wait_for_url() {
  local url="$1"
  local attempts="${2:-60}"

  for ((i = 0; i < attempts; i++)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for ${url}" >&2
  return 1
}

trap cleanup EXIT

cd "${ROOT_DIR}"
docker compose up -d db

cd "${ROOT_DIR}/backend"
SESSION_SECRET=dev-session-secret-change-in-production-64chars \
  CORS_ORIGIN=http://127.0.0.1:4173 \
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/cash_request?sslmode=disable \
  PORT=18080 \
  ENVIRONMENT=development \
  go run ./cmd/server/main.go &
BACKEND_PID=$!

wait_for_url "http://127.0.0.1:18080/api/csrf"

cd "${ROOT_DIR}/frontend"
COREPACK_HOME="${ROOT_DIR}/.cache/corepack" corepack pnpm exec playwright test "$@"
