package service

import (
	"github.com/selmant/cash-request/backend/internal/db/store"
)

type AuthService struct {
	queries *store.Queries
}

func NewAuthService(queries *store.Queries) *AuthService {
	return &AuthService{queries: queries}
}
