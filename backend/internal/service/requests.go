package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/selmant/cash-request/backend/internal/db/store"
)

var (
	ErrInvalidAmount       = errors.New("amount must be between $0.01 and $10,000.00")
	ErrInvalidAmountFormat = errors.New("amount must have at most 2 decimal places")
	ErrRecipientRequired  = errors.New("recipient email or phone is required")
	ErrSelfRequest        = errors.New("you cannot request money from yourself")
	ErrNoteLengthExceeded = errors.New("note must be 500 characters or fewer")
)

type RequestService struct {
	queries *store.Queries
}

func NewRequestService(queries *store.Queries) *RequestService {
	return &RequestService{queries: queries}
}

type CreateRequestInput struct {
	SenderID       pgtype.UUID
	SenderEmail    string
	SenderPhone    *string
	RecipientEmail string
	RecipientPhone string
	Amount         string
	Note           string
}

type CreateRequestResult struct {
	Request store.PaymentRequest
}

func (s *RequestService) Create(ctx context.Context, input CreateRequestInput) (store.PaymentRequest, error) {
	// Validate recipient
	recipientEmail := strings.TrimSpace(input.RecipientEmail)
	recipientPhone := strings.TrimSpace(input.RecipientPhone)

	if recipientEmail == "" && recipientPhone == "" {
		return store.PaymentRequest{}, ErrRecipientRequired
	}

	details := make(map[string]string)

	if recipientEmail != "" {
		recipientEmail = strings.ToLower(recipientEmail)
		if !emailRegex.MatchString(recipientEmail) {
			details["recipient_email"] = "Invalid email format"
		}
	}

	if recipientPhone != "" {
		if !phoneRegex.MatchString(recipientPhone) {
			details["recipient_phone"] = "Invalid phone format (must be E.164, e.g. +14155551234)"
		}
	}

	// Self-request prevention
	if recipientEmail != "" && recipientEmail == strings.ToLower(input.SenderEmail) {
		return store.PaymentRequest{}, ErrSelfRequest
	}
	if recipientPhone != "" && input.SenderPhone != nil && recipientPhone == *input.SenderPhone {
		return store.PaymentRequest{}, ErrSelfRequest
	}

	// Validate amount
	amountMinor, err := parseAmount(input.Amount)
	if err != nil {
		details["amount"] = err.Error()
	}

	// Validate note
	if len(input.Note) > 500 {
		details["note"] = ErrNoteLengthExceeded.Error()
	}

	if len(details) > 0 {
		return store.PaymentRequest{}, &ValidationError{Details: details}
	}

	// Generate share token
	shareToken, err := generateShareToken()
	if err != nil {
		return store.PaymentRequest{}, fmt.Errorf("generating share token: %w", err)
	}

	// Resolve recipient if they have an account
	var recipientID pgtype.UUID
	if recipientEmail != "" {
		if user, err := s.queries.GetUserByEmail(ctx, recipientEmail); err == nil {
			recipientID = user.ID
		}
	}
	if !recipientID.Valid && recipientPhone != "" {
		if user, err := s.queries.GetUserByPhone(ctx, &recipientPhone); err == nil {
			recipientID = user.ID
		}
	}

	var emailPtr, phonePtr, notePtr *string
	if recipientEmail != "" {
		emailPtr = &recipientEmail
	}
	if recipientPhone != "" {
		phonePtr = &recipientPhone
	}
	if input.Note != "" {
		notePtr = &input.Note
	}

	pr, err := s.queries.CreatePaymentRequest(ctx, store.CreatePaymentRequestParams{
		SenderID:       input.SenderID,
		RecipientEmail: emailPtr,
		RecipientPhone: phonePtr,
		RecipientID:    recipientID,
		AmountMinor:    amountMinor,
		Note:           notePtr,
		ShareToken:     shareToken,
	})
	if err != nil {
		return store.PaymentRequest{}, fmt.Errorf("creating payment request: %w", err)
	}

	return pr, nil
}

func parseAmount(s string) (int32, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, ErrInvalidAmount
	}

	parts := strings.Split(s, ".")
	if len(parts) > 2 {
		return 0, ErrInvalidAmount
	}
	if len(parts) == 2 && len(parts[1]) > 2 {
		return 0, ErrInvalidAmountFormat
	}

	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, ErrInvalidAmount
	}

	cents := int32(math.Round(f * 100))
	if cents <= 0 || cents > 1000000 {
		return 0, ErrInvalidAmount
	}

	return cents, nil
}

func generateShareToken() (string, error) {
	b := make([]byte, 16) // 128 bits
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(b), nil
}

type ValidationError struct {
	Details map[string]string
}

func (e *ValidationError) Error() string {
	return "validation failed"
}

func IsValidationError(err error) (*ValidationError, bool) {
	var ve *ValidationError
	if errors.As(err, &ve) {
		return ve, true
	}
	return nil, false
}
