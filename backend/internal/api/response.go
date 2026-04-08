package api

import (
	"encoding/json"
	"net/http"
)

type ErrorResponse struct {
	Error   string            `json:"error"`
	Code    string            `json:"code"`
	Details map[string]string `json:"details,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data) //nolint:errcheck
}

func writeError(w http.ResponseWriter, status int, message, code string) {
	writeJSON(w, status, ErrorResponse{
		Error: message,
		Code:  code,
	})
}

func writeValidationError(w http.ResponseWriter, details map[string]string) {
	writeJSON(w, http.StatusBadRequest, ErrorResponse{
		Error:   "Validation failed",
		Code:    "VALIDATION_ERROR",
		Details: details,
	})
}
