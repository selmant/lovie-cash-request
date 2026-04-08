package service

import (
	"github.com/selmant/cash-request/backend/internal/db/store"
)

type RequestService struct {
	queries *store.Queries
}

func NewRequestService(queries *store.Queries) *RequestService {
	return &RequestService{queries: queries}
}
