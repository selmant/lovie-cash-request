-- name: CreateUser :one
INSERT INTO users (email, phone, display_name)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: GetUserByPhone :one
SELECT * FROM users WHERE phone = $1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: ResolveRecipientByEmail :exec
UPDATE payment_requests
SET recipient_id = $1, updated_at = now()
WHERE recipient_email = $2 AND recipient_id IS NULL;

-- name: ResolveRecipientByPhone :exec
UPDATE payment_requests
SET recipient_id = $1, updated_at = now()
WHERE recipient_phone = $2 AND recipient_id IS NULL;
