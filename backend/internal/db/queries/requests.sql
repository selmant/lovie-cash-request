-- name: CreatePaymentRequest :one
INSERT INTO payment_requests (
    sender_id, recipient_email, recipient_phone, recipient_id,
    amount_minor, note, share_token, expires_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, now() + INTERVAL '7 days')
RETURNING *;

-- name: GetPaymentRequestByID :one
SELECT
    pr.*,
    CASE
        WHEN pr.status = 'pending' AND pr.expires_at < now() THEN 'expired'
        ELSE pr.status
    END AS display_status,
    s.email AS sender_email,
    s.display_name AS sender_display_name,
    r.email AS recipient_resolved_email,
    r.phone AS recipient_resolved_phone,
    r.display_name AS recipient_display_name
FROM payment_requests pr
JOIN users s ON s.id = pr.sender_id
LEFT JOIN users r ON r.id = pr.recipient_id
WHERE pr.id = $1;

-- name: GetPaymentRequestByShareToken :one
SELECT
    pr.*,
    CASE
        WHEN pr.status = 'pending' AND pr.expires_at < now() THEN 'expired'
        ELSE pr.status
    END AS display_status,
    s.email AS sender_email,
    s.display_name AS sender_display_name,
    r.email AS recipient_resolved_email,
    r.phone AS recipient_resolved_phone,
    r.display_name AS recipient_display_name
FROM payment_requests pr
JOIN users s ON s.id = pr.sender_id
LEFT JOIN users r ON r.id = pr.recipient_id
WHERE pr.share_token = $1;

-- name: TransitionStatus :one
UPDATE payment_requests
SET status = $1, idempotency_key = $2, updated_at = now()
WHERE id = $3
  AND status = 'pending'
  AND expires_at > now()
RETURNING *;

-- name: GetPaymentRequestRaw :one
SELECT * FROM payment_requests WHERE id = $1;

-- name: ListOutgoingRequests :many
SELECT
    pr.*,
    CASE
        WHEN pr.status = 'pending' AND pr.expires_at < now() THEN 'expired'
        ELSE pr.status
    END AS display_status,
    s.email AS sender_email,
    s.display_name AS sender_display_name,
    r.email AS recipient_resolved_email,
    r.phone AS recipient_resolved_phone,
    r.display_name AS recipient_display_name
FROM payment_requests pr
JOIN users s ON s.id = pr.sender_id
LEFT JOIN users r ON r.id = pr.recipient_id
WHERE pr.sender_id = $1
  AND (sqlc.narg('status')::text IS NULL OR
       CASE
           WHEN sqlc.narg('status')::text = 'expired' THEN pr.status = 'pending' AND pr.expires_at < now()
           WHEN sqlc.narg('status')::text = 'pending' THEN pr.status = 'pending' AND pr.expires_at >= now()
           ELSE pr.status = sqlc.narg('status')::text
       END)
  AND (sqlc.narg('search')::text IS NULL OR
       COALESCE(pr.recipient_email, '') ILIKE '%' || sqlc.narg('search')::text || '%' OR
       COALESCE(pr.recipient_phone, '') ILIKE '%' || sqlc.narg('search')::text || '%' OR
       COALESCE(r.email, '') ILIKE '%' || sqlc.narg('search')::text || '%' OR
       COALESCE(r.phone, '') ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY pr.created_at DESC;

-- name: ListIncomingRequests :many
SELECT
    pr.*,
    CASE
        WHEN pr.status = 'pending' AND pr.expires_at < now() THEN 'expired'
        ELSE pr.status
    END AS display_status,
    s.email AS sender_email,
    s.display_name AS sender_display_name,
    r.email AS recipient_resolved_email,
    r.phone AS recipient_resolved_phone,
    r.display_name AS recipient_display_name
FROM payment_requests pr
JOIN users s ON s.id = pr.sender_id
LEFT JOIN users r ON r.id = pr.recipient_id
WHERE (pr.recipient_id = $1 OR pr.recipient_email = $2 OR pr.recipient_phone = $3)
  AND (sqlc.narg('status')::text IS NULL OR
       CASE
           WHEN sqlc.narg('status')::text = 'expired' THEN pr.status = 'pending' AND pr.expires_at < now()
           WHEN sqlc.narg('status')::text = 'pending' THEN pr.status = 'pending' AND pr.expires_at >= now()
           ELSE pr.status = sqlc.narg('status')::text
       END)
  AND (sqlc.narg('search')::text IS NULL OR
       COALESCE(s.email, '') ILIKE '%' || sqlc.narg('search')::text || '%' OR
       COALESCE(s.phone, '') ILIKE '%' || sqlc.narg('search')::text || '%' OR
       COALESCE(s.display_name, '') ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY pr.created_at DESC;
