package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/selmant/cash-request/backend/internal/db/store"
)

var (
	ErrInvalidEmail    = errors.New("invalid email format")
	ErrInvalidPhone    = errors.New("invalid phone format (must be E.164, e.g. +14155551234)")
	ErrEmailExists     = errors.New("account already exists. Please log in.")
	ErrAccountNotFound = errors.New("account not found. Please sign up.")
)

var (
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	phoneRegex = regexp.MustCompile(`^\+[1-9]\d{1,14}$`)
)

type AuthService struct {
	queries *store.Queries
}

func NewAuthService(queries *store.Queries) *AuthService {
	return &AuthService{queries: queries}
}

type SignupInput struct {
	Email string
	Phone string
}

func (s *AuthService) Signup(ctx context.Context, input SignupInput) (store.User, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if !emailRegex.MatchString(email) {
		return store.User{}, ErrInvalidEmail
	}

	var phone *string
	if input.Phone != "" {
		if !phoneRegex.MatchString(input.Phone) {
			return store.User{}, ErrInvalidPhone
		}
		phone = &input.Phone
	}

	// Check if user already exists
	_, err := s.queries.GetUserByEmail(ctx, email)
	if err == nil {
		return store.User{}, ErrEmailExists
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return store.User{}, fmt.Errorf("checking existing user: %w", err)
	}

	displayName := email[:strings.Index(email, "@")]

	user, err := s.queries.CreateUser(ctx, store.CreateUserParams{
		Email:       email,
		Phone:       phone,
		DisplayName: displayName,
	})
	if err != nil {
		return store.User{}, fmt.Errorf("creating user: %w", err)
	}

	// Resolve pending payment requests for this user
	if err := s.resolveRecipient(ctx, user); err != nil {
		// Non-fatal: user is created, just log resolution failure
		return user, nil
	}

	return user, nil
}

func (s *AuthService) Login(ctx context.Context, email string) (store.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !emailRegex.MatchString(email) {
		return store.User{}, ErrInvalidEmail
	}

	user, err := s.queries.GetUserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return store.User{}, ErrAccountNotFound
	}
	if err != nil {
		return store.User{}, fmt.Errorf("finding user: %w", err)
	}

	// Resolve pending payment requests for this user
	if err := s.resolveRecipient(ctx, user); err != nil {
		return user, nil
	}

	return user, nil
}

func (s *AuthService) GetUser(ctx context.Context, id pgtype.UUID) (store.User, error) {
	return s.queries.GetUserByID(ctx, id)
}

func (s *AuthService) resolveRecipient(ctx context.Context, user store.User) error {
	email := user.Email
	if err := s.queries.ResolveRecipientByEmail(ctx, store.ResolveRecipientByEmailParams{
		RecipientID:    user.ID,
		RecipientEmail: &email,
	}); err != nil {
		return err
	}

	if user.Phone != nil {
		if err := s.queries.ResolveRecipientByPhone(ctx, store.ResolveRecipientByPhoneParams{
			RecipientID:    user.ID,
			RecipientPhone: user.Phone,
		}); err != nil {
			return err
		}
	}

	return nil
}
