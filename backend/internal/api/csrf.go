package api

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"
)

func generateCSRFToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func setCSRFCookie(w http.ResponseWriter, token string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     "csrf_token",
		Value:    token,
		Path:     "/",
		HttpOnly: false,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	})
}

func handleCSRF(secure bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, err := generateCSRFToken()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to generate CSRF token", "INTERNAL_ERROR")
			return
		}
		setCSRFCookie(w, token, secure)
		writeJSON(w, http.StatusOK, map[string]string{"token": token})
	}
}

func csrfMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		// Skip CSRF for signup and login (CSRF token bootstrapped after)
		path := r.URL.Path
		if path == "/api/auth/signup" || path == "/api/auth/login" {
			next.ServeHTTP(w, r)
			return
		}

		cookie, err := r.Cookie("csrf_token")
		if err != nil {
			writeError(w, http.StatusForbidden, "CSRF token missing", "FORBIDDEN")
			return
		}

		header := r.Header.Get("X-CSRF-Token")
		if header == "" || !strings.EqualFold(cookie.Value, header) {
			writeError(w, http.StatusForbidden, "CSRF token mismatch", "FORBIDDEN")
			return
		}

		next.ServeHTTP(w, r)
	})
}
