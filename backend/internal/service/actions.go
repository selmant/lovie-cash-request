package service

import (
	"github.com/selmant/cash-request/backend/internal/db/store"
)

type ActionService struct {
	queries *store.Queries
}

func NewActionService(queries *store.Queries) *ActionService {
	return &ActionService{queries: queries}
}
