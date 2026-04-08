-- +goose Up
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_phone_unique UNIQUE (phone)
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_phone ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id),
    recipient_email TEXT,
    recipient_phone TEXT,
    recipient_id UUID REFERENCES users(id),
    amount_minor INTEGER NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    share_token TEXT UNIQUE NOT NULL,
    idempotency_key TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_requests_amount_positive CHECK (amount_minor > 0),
    CONSTRAINT payment_requests_amount_max CHECK (amount_minor <= 1000000),
    CONSTRAINT payment_requests_status_valid CHECK (status IN ('pending', 'paid', 'declined', 'cancelled')),
    CONSTRAINT payment_requests_recipient_required CHECK (recipient_email IS NOT NULL OR recipient_phone IS NOT NULL),
    CONSTRAINT payment_requests_note_length CHECK (note IS NULL OR length(note) <= 500)
);

CREATE INDEX idx_payment_requests_sender ON payment_requests (sender_id, created_at DESC);
CREATE INDEX idx_payment_requests_recipient_email ON payment_requests (recipient_email, created_at DESC) WHERE recipient_email IS NOT NULL;
CREATE INDEX idx_payment_requests_recipient_phone ON payment_requests (recipient_phone, created_at DESC) WHERE recipient_phone IS NOT NULL;
CREATE INDEX idx_payment_requests_recipient_id ON payment_requests (recipient_id, created_at DESC);
CREATE INDEX idx_payment_requests_status ON payment_requests (status);
CREATE INDEX idx_payment_requests_share_token ON payment_requests (share_token);

CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    data BYTEA NOT NULL,
    expiry TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_expiry ON sessions (expiry);

-- +goose Down
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS payment_requests;
DROP TABLE IF EXISTS users;
