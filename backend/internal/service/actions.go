package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/selmant/cash-request/backend/internal/db/store"
)

var (
	ErrNotRecipient   = errors.New("not authorized: you are not the recipient")
	ErrNotSender      = errors.New("not authorized: you are not the sender")
	ErrRequestExpired = errors.New("this request has expired")
	ErrConflict       = errors.New("request has already been modified. Please refresh.")
	ErrNotFound       = errors.New("request not found")
	ErrMissingIdemKey = errors.New("Idempotency-Key header is required")
)

type ActionService struct {
	queries *store.Queries
}

func NewActionService(queries *store.Queries) *ActionService {
	return &ActionService{queries: queries}
}

type ActionInput struct {
	RequestID      pgtype.UUID
	UserID         pgtype.UUID
	UserEmail      string
	UserPhone      *string
	IdempotencyKey string
}

func (s *ActionService) Pay(ctx context.Context, input ActionInput) (store.PaymentRequest, error) {
	pr, err := s.getAndValidate(ctx, input, "recipient")
	if err != nil {
		return store.PaymentRequest{}, err
	}

	// Simulate payment processing delay (2-3 seconds)
	delay := 2*time.Second + time.Duration(rand.Int63n(int64(time.Second))) //nolint:gosec
	time.Sleep(delay)

	return s.transition(ctx, pr, "paid", input.IdempotencyKey)
}

func (s *ActionService) Decline(ctx context.Context, input ActionInput) (store.PaymentRequest, error) {
	pr, err := s.getAndValidate(ctx, input, "recipient")
	if err != nil {
		return store.PaymentRequest{}, err
	}

	return s.transition(ctx, pr, "declined", input.IdempotencyKey)
}

func (s *ActionService) Cancel(ctx context.Context, input ActionInput) (store.PaymentRequest, error) {
	pr, err := s.getAndValidate(ctx, input, "sender")
	if err != nil {
		return store.PaymentRequest{}, err
	}

	return s.transition(ctx, pr, "cancelled", input.IdempotencyKey)
}

func (s *ActionService) getAndValidate(ctx context.Context, input ActionInput, requiredRole string) (store.PaymentRequest, error) {
	if input.IdempotencyKey == "" {
		return store.PaymentRequest{}, ErrMissingIdemKey
	}

	pr, err := s.queries.GetPaymentRequestRaw(ctx, input.RequestID)
	if errors.Is(err, pgx.ErrNoRows) {
		return store.PaymentRequest{}, ErrNotFound
	}
	if err != nil {
		return store.PaymentRequest{}, fmt.Errorf("fetching request: %w", err)
	}

	// Role check
	switch requiredRole {
	case "recipient":
		isRecipient := false
		if pr.RecipientID.Valid && pr.RecipientID.Bytes == input.UserID.Bytes {
			isRecipient = true
		}
		if !isRecipient && pr.RecipientEmail != nil && *pr.RecipientEmail == input.UserEmail {
			isRecipient = true
		}
		if !isRecipient && pr.RecipientPhone != nil && input.UserPhone != nil && *pr.RecipientPhone == *input.UserPhone {
			isRecipient = true
		}
		if !isRecipient {
			return store.PaymentRequest{}, ErrNotRecipient
		}
	case "sender":
		if pr.SenderID.Bytes != input.UserID.Bytes {
			return store.PaymentRequest{}, ErrNotSender
		}
	}

	// Expiration check
	if pr.Status == "pending" && pr.ExpiresAt.Time.Before(time.Now()) {
		return store.PaymentRequest{}, ErrRequestExpired
	}

	return pr, nil
}

func (s *ActionService) transition(ctx context.Context, pr store.PaymentRequest, newStatus, idempotencyKey string) (store.PaymentRequest, error) {
	result, err := s.queries.TransitionStatus(ctx, store.TransitionStatusParams{
		Status:         newStatus,
		IdempotencyKey: &idempotencyKey,
		ID:             pr.ID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// Check if idempotent retry
		current, ferr := s.queries.GetPaymentRequestRaw(ctx, pr.ID)
		if ferr != nil {
			return store.PaymentRequest{}, ErrConflict
		}
		if current.IdempotencyKey != nil && *current.IdempotencyKey == idempotencyKey {
			return current, nil // Idempotent success
		}
		if current.Status == "pending" && current.ExpiresAt.Time.Before(time.Now()) {
			return store.PaymentRequest{}, ErrRequestExpired
		}
		return store.PaymentRequest{}, ErrConflict
	}
	if err != nil {
		return store.PaymentRequest{}, fmt.Errorf("transitioning status: %w", err)
	}

	return result, nil
}
