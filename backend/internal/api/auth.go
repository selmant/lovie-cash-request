package api

import "net/http"

func (s *Server) handleSignup() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}

func (s *Server) handleLogin() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}

func (s *Server) handleLogout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}

func (s *Server) handleMe() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}
