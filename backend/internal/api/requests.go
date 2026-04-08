package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/selmant/cash-request/backend/internal/db/store"
	"github.com/selmant/cash-request/backend/internal/service"
)

type createRequestBody struct {
	RecipientEmail string `json:"recipient_email"`
	RecipientPhone string `json:"recipient_phone"`
	Amount         string `json:"amount"`
	Note           string `json:"note"`
}

type requestJSON struct {
	ID             string         `json:"id"`
	Sender         senderJSON     `json:"sender"`
	RecipientEmail *string        `json:"recipient_email"`
	RecipientPhone *string        `json:"recipient_phone"`
	Recipient      *recipientJSON `json:"recipient"`
	AmountMinor    int32          `json:"amount_minor"`
	AmountDisplay  string         `json:"amount_display"`
	Note           *string        `json:"note"`
	Status         string         `json:"status"`
	ShareToken     string         `json:"share_token"`
	ShareURL       string         `json:"share_url"`
	ExpiresAt      string         `json:"expires_at"`
	CreatedAt      string         `json:"created_at"`
}

type senderJSON struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
}

type recipientJSON struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	Phone       *string `json:"phone"`
	DisplayName string  `json:"display_name"`
}

func formatAmount(cents int32) string {
	dollars := float64(cents) / 100
	return fmt.Sprintf("$%.2f", dollars)
}

func toRequestJSONFromRow(row store.GetPaymentRequestByIDRow) requestJSON {
	rj := requestJSON{
		ID: uuidToString(row.ID),
		Sender: senderJSON{
			ID:          uuidToString(row.SenderID),
			Email:       row.SenderEmail,
			DisplayName: row.SenderDisplayName,
		},
		RecipientEmail: row.RecipientEmail,
		RecipientPhone: row.RecipientPhone,
		AmountMinor:    row.AmountMinor,
		AmountDisplay:  formatAmount(row.AmountMinor),
		Note:           row.Note,
		Status:         fmt.Sprintf("%v", row.DisplayStatus),
		ShareToken:     row.ShareToken,
		ShareURL:       "/r/" + row.ShareToken,
		ExpiresAt:      row.ExpiresAt.Time.Format("2006-01-02T15:04:05Z"),
		CreatedAt:      row.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
	}

	if row.RecipientDisplayName != nil {
		rj.Recipient = &recipientJSON{
			ID:          uuidToString(row.RecipientID),
			Email:       deref(row.RecipientResolvedEmail),
			Phone:       row.RecipientResolvedPhone,
			DisplayName: *row.RecipientDisplayName,
		}
	}

	return rj
}

func toRequestJSONFromShareRow(row store.GetPaymentRequestByShareTokenRow) requestJSON {
	rj := requestJSON{
		ID: uuidToString(row.ID),
		Sender: senderJSON{
			ID:          uuidToString(row.SenderID),
			Email:       row.SenderEmail,
			DisplayName: row.SenderDisplayName,
		},
		RecipientEmail: row.RecipientEmail,
		RecipientPhone: row.RecipientPhone,
		AmountMinor:    row.AmountMinor,
		AmountDisplay:  formatAmount(row.AmountMinor),
		Note:           row.Note,
		Status:         fmt.Sprintf("%v", row.DisplayStatus),
		ShareToken:     row.ShareToken,
		ShareURL:       "/r/" + row.ShareToken,
		ExpiresAt:      row.ExpiresAt.Time.Format("2006-01-02T15:04:05Z"),
		CreatedAt:      row.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
	}

	if row.RecipientDisplayName != nil {
		rj.Recipient = &recipientJSON{
			ID:          uuidToString(row.RecipientID),
			Email:       deref(row.RecipientResolvedEmail),
			Phone:       row.RecipientResolvedPhone,
			DisplayName: *row.RecipientDisplayName,
		}
	}

	return rj
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (s *Server) handleCreateRequest() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body createRequestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid request body", "VALIDATION_ERROR")
			return
		}

		userID := getUserID(r.Context())
		pgUUID := pgtype.UUID{Bytes: userID, Valid: true}

		// Get sender info for self-request check
		user, err := s.authService.GetUser(r.Context(), pgUUID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			return
		}

		pr, err := s.requestService.Create(r.Context(), service.CreateRequestInput{
			SenderID:       pgUUID,
			SenderEmail:    user.Email,
			SenderPhone:    user.Phone,
			RecipientEmail: body.RecipientEmail,
			RecipientPhone: body.RecipientPhone,
			Amount:         body.Amount,
			Note:           body.Note,
		})
		if err != nil {
			if ve, ok := service.IsValidationError(err); ok {
				writeValidationError(w, ve.Details)
				return
			}
			if errors.Is(err, service.ErrSelfRequest) {
				writeError(w, http.StatusUnprocessableEntity, err.Error(), "VALIDATION_ERROR")
				return
			}
			writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			return
		}

		// Fetch full row with joined data
		fullRow, err := s.queries.GetPaymentRequestByID(r.Context(), pr.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			return
		}

		writeJSON(w, http.StatusCreated, map[string]any{"request": toRequestJSONFromRow(fullRow)})
	}
}

func (s *Server) handleGetRequest() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			writeError(w, http.StatusNotFound, "Request not found", "NOT_FOUND")
			return
		}

		pgUUID := pgtype.UUID{Bytes: id, Valid: true}
		row, err := s.queries.GetPaymentRequestByID(r.Context(), pgUUID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Request not found", "NOT_FOUND")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			return
		}

		// Auth check: sender or recipient only
		userID := getUserID(r.Context())
		if !isAuthorized(userID, row.SenderID, row.RecipientID) {
			user, uerr := s.authService.GetUser(r.Context(), pgtype.UUID{Bytes: userID, Valid: true})
			if uerr != nil {
				writeError(w, http.StatusForbidden, "Not authorized to view this request", "FORBIDDEN")
				return
			}

			emailMatch := row.RecipientEmail != nil && user.Email == *row.RecipientEmail
			phoneMatch := row.RecipientPhone != nil && user.Phone != nil && *user.Phone == *row.RecipientPhone
			if !emailMatch && !phoneMatch {
				writeError(w, http.StatusForbidden, "Not authorized to view this request", "FORBIDDEN")
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{"request": toRequestJSONFromRow(row)})
	}
}

func (s *Server) handleGetRequestByToken() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := chi.URLParam(r, "shareToken")

		row, err := s.queries.GetPaymentRequestByShareToken(r.Context(), token)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Request not found", "NOT_FOUND")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			return
		}

		// Auth check
		userID := getUserID(r.Context())
		senderID := row.SenderID
		recipientID := row.RecipientID
		if userID != senderID.Bytes && (!recipientID.Valid || userID != recipientID.Bytes) {
			// Check email/phone match
			user, uerr := s.authService.GetUser(r.Context(), pgtype.UUID{Bytes: userID, Valid: true})
			if uerr != nil {
				writeError(w, http.StatusForbidden, "Not authorized to view this request", "FORBIDDEN")
				return
			}
			emailMatch := row.RecipientEmail != nil && user.Email == *row.RecipientEmail
			phoneMatch := row.RecipientPhone != nil && user.Phone != nil && *user.Phone == *row.RecipientPhone
			if !emailMatch && !phoneMatch {
				writeError(w, http.StatusForbidden, "Not authorized to view this request", "FORBIDDEN")
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{"request": toRequestJSONFromShareRow(row)})
	}
}

func (s *Server) handleListRequests() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := getUserID(r.Context())
		pgUUID := pgtype.UUID{Bytes: userID, Valid: true}

		direction := r.URL.Query().Get("direction")
		if direction == "" {
			direction = "outgoing"
		}

		var statusPtr, searchPtr *string
		if st := r.URL.Query().Get("status"); st != "" {
			statusPtr = &st
		}
		if sr := r.URL.Query().Get("search"); sr != "" {
			searchPtr = &sr
		}

		var results []requestJSON

		if direction == "incoming" {
			user, err := s.authService.GetUser(r.Context(), pgUUID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
				return
			}

			rows, err := s.queries.ListIncomingRequests(r.Context(), store.ListIncomingRequestsParams{
				RecipientID:    pgUUID,
				RecipientEmail: &user.Email,
				RecipientPhone: user.Phone,
				Status:         statusPtr,
				Search:         searchPtr,
			})
			if err != nil {
				writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
				return
			}

			results = make([]requestJSON, len(rows))
			for i, row := range rows {
				results[i] = toRequestJSONFromIncomingRow(row)
			}
		} else {
			rows, err := s.queries.ListOutgoingRequests(r.Context(), store.ListOutgoingRequestsParams{
				SenderID: pgUUID,
				Status:   statusPtr,
				Search:   searchPtr,
			})
			if err != nil {
				writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
				return
			}

			results = make([]requestJSON, len(rows))
			for i, row := range rows {
				results[i] = toRequestJSONFromOutgoingRow(row)
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{"requests": results})
	}
}

func toRequestJSONFromOutgoingRow(row store.ListOutgoingRequestsRow) requestJSON {
	rj := requestJSON{
		ID: uuidToString(row.ID),
		Sender: senderJSON{
			ID:          uuidToString(row.SenderID),
			Email:       row.SenderEmail,
			DisplayName: row.SenderDisplayName,
		},
		RecipientEmail: row.RecipientEmail,
		RecipientPhone: row.RecipientPhone,
		AmountMinor:    row.AmountMinor,
		AmountDisplay:  formatAmount(row.AmountMinor),
		Note:           row.Note,
		Status:         fmt.Sprintf("%v", row.DisplayStatus),
		ShareToken:     row.ShareToken,
		ShareURL:       "/r/" + row.ShareToken,
		ExpiresAt:      row.ExpiresAt.Time.Format("2006-01-02T15:04:05Z"),
		CreatedAt:      row.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
	}
	if row.RecipientDisplayName != nil {
		rj.Recipient = &recipientJSON{
			ID:          uuidToString(row.RecipientID),
			Email:       deref(row.RecipientResolvedEmail),
			Phone:       row.RecipientResolvedPhone,
			DisplayName: *row.RecipientDisplayName,
		}
	}
	return rj
}

func toRequestJSONFromIncomingRow(row store.ListIncomingRequestsRow) requestJSON {
	rj := requestJSON{
		ID: uuidToString(row.ID),
		Sender: senderJSON{
			ID:          uuidToString(row.SenderID),
			Email:       row.SenderEmail,
			DisplayName: row.SenderDisplayName,
		},
		RecipientEmail: row.RecipientEmail,
		RecipientPhone: row.RecipientPhone,
		AmountMinor:    row.AmountMinor,
		AmountDisplay:  formatAmount(row.AmountMinor),
		Note:           row.Note,
		Status:         fmt.Sprintf("%v", row.DisplayStatus),
		ShareToken:     row.ShareToken,
		ShareURL:       "/r/" + row.ShareToken,
		ExpiresAt:      row.ExpiresAt.Time.Format("2006-01-02T15:04:05Z"),
		CreatedAt:      row.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
	}
	if row.RecipientDisplayName != nil {
		rj.Recipient = &recipientJSON{
			ID:          uuidToString(row.RecipientID),
			Email:       deref(row.RecipientResolvedEmail),
			Phone:       row.RecipientResolvedPhone,
			DisplayName: *row.RecipientDisplayName,
		}
	}
	return rj
}

func isAuthorized(userID uuid.UUID, senderID, recipientID pgtype.UUID) bool {
	if userID == senderID.Bytes {
		return true
	}
	if recipientID.Valid && userID == recipientID.Bytes {
		return true
	}
	return false
}

func (s *Server) handlePayRequest() http.HandlerFunc {
	return s.handleAction("pay")
}

func (s *Server) handleDeclineRequest() http.HandlerFunc {
	return s.handleAction("decline")
}

func (s *Server) handleCancelRequest() http.HandlerFunc {
	return s.handleAction("cancel")
}

func (s *Server) handleAction(action string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			writeError(w, http.StatusNotFound, "Request not found", "NOT_FOUND")
			return
		}

		idempotencyKey := r.Header.Get("Idempotency-Key")
		if idempotencyKey == "" {
			writeError(w, http.StatusBadRequest, "Idempotency-Key header is required", "VALIDATION_ERROR")
			return
		}

		userID := getUserID(r.Context())
		pgUserID := pgtype.UUID{Bytes: userID, Valid: true}
		pgReqID := pgtype.UUID{Bytes: id, Valid: true}

		user, err := s.authService.GetUser(r.Context(), pgUserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			return
		}

		input := service.ActionInput{
			RequestID:      pgReqID,
			UserID:         pgUserID,
			UserEmail:      user.Email,
			UserPhone:      user.Phone,
			IdempotencyKey: idempotencyKey,
		}

		var result store.PaymentRequest
		switch action {
		case "pay":
			result, err = s.actionService.Pay(r.Context(), input)
		case "decline":
			result, err = s.actionService.Decline(r.Context(), input)
		case "cancel":
			result, err = s.actionService.Cancel(r.Context(), input)
		}

		if err != nil {
			switch {
			case errors.Is(err, service.ErrNotRecipient), errors.Is(err, service.ErrNotSender):
				writeError(w, http.StatusForbidden, err.Error(), "FORBIDDEN")
			case errors.Is(err, service.ErrRequestExpired):
				writeError(w, http.StatusGone, err.Error(), "EXPIRED")
			case errors.Is(err, service.ErrConflict):
				writeError(w, http.StatusConflict, err.Error(), "CONFLICT")
			case errors.Is(err, service.ErrNotFound):
				writeError(w, http.StatusNotFound, "Request not found", "NOT_FOUND")
			default:
				writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			}
			return
		}

		// Re-fetch full row with joins for response
		fullRow, err := s.queries.GetPaymentRequestByID(r.Context(), result.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"request": toRequestJSONFromRow(fullRow)})
	}
}
