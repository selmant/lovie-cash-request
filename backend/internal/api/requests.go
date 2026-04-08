package api

import "net/http"

func (s *Server) handleCreateRequest() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}

func (s *Server) handleListRequests() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}

func (s *Server) handleGetRequest() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}

func (s *Server) handleGetRequestByToken() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}

func (s *Server) handlePayRequest() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}

func (s *Server) handleDeclineRequest() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}

func (s *Server) handleCancelRequest() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "Not implemented", "INTERNAL_ERROR")
	}
}
