package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/selmant/cash-request/backend/internal/db/store"
	"github.com/selmant/cash-request/backend/internal/service"
)

type signupRequest struct {
	Email string `json:"email"`
	Phone string `json:"phone"`
}

type loginRequest struct {
	Email string `json:"email"`
}

type userResponse struct {
	User userJSON `json:"user"`
}

type userJSON struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	Phone       *string `json:"phone"`
	DisplayName string  `json:"display_name"`
	CreatedAt   string  `json:"created_at"`
}

func toUserJSON(u store.User) userJSON {
	return userJSON{
		ID:          uuidToString(u.ID),
		Email:       u.Email,
		Phone:       u.Phone,
		DisplayName: u.DisplayName,
		CreatedAt:   u.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
	}
}

func uuidToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}

func (s *Server) handleSignup() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req signupRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid request body", "VALIDATION_ERROR")
			return
		}

		user, err := s.authService.Signup(r.Context(), service.SignupInput{
			Email: req.Email,
			Phone: req.Phone,
		})
		if err != nil {
			switch {
			case errors.Is(err, service.ErrInvalidEmail):
				writeValidationError(w, map[string]string{"email": err.Error()})
			case errors.Is(err, service.ErrInvalidPhone):
				writeValidationError(w, map[string]string{"phone": err.Error()})
			case errors.Is(err, service.ErrEmailExists):
				writeError(w, http.StatusConflict, err.Error(), "CONFLICT")
			default:
				writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			}
			return
		}

		s.sessionManager.Put(r.Context(), "userID", uuidToString(user.ID))

		// Set CSRF cookie on signup
		token, err := generateCSRFToken()
		if err == nil {
			setCSRFCookie(w, token, false)
		}

		writeJSON(w, http.StatusCreated, userResponse{User: toUserJSON(user)})
	}
}

func (s *Server) handleLogin() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid request body", "VALIDATION_ERROR")
			return
		}

		user, err := s.authService.Login(r.Context(), req.Email)
		if err != nil {
			switch {
			case errors.Is(err, service.ErrInvalidEmail):
				writeValidationError(w, map[string]string{"email": err.Error()})
			case errors.Is(err, service.ErrAccountNotFound):
				writeError(w, http.StatusNotFound, err.Error(), "NOT_FOUND")
			default:
				writeError(w, http.StatusInternalServerError, "Internal server error", "INTERNAL_ERROR")
			}
			return
		}

		s.sessionManager.Put(r.Context(), "userID", uuidToString(user.ID))

		token, err := generateCSRFToken()
		if err == nil {
			setCSRFCookie(w, token, false)
		}

		writeJSON(w, http.StatusOK, userResponse{User: toUserJSON(user)})
	}
}

func (s *Server) handleLogout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := s.sessionManager.Destroy(r.Context()); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to destroy session", "INTERNAL_ERROR")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"message": "Logged out"})
	}
}

func (s *Server) handleMe() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := getUserID(r.Context())

		pgUUID := pgtype.UUID{Bytes: userID, Valid: true}
		user, err := s.authService.GetUser(r.Context(), pgUUID)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "User not found", "UNAUTHORIZED")
			return
		}

		writeJSON(w, http.StatusOK, userResponse{User: toUserJSON(user)})
	}
}
