package api

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/selmant/cash-request/backend/internal/db/store"
	"github.com/selmant/cash-request/backend/internal/service"
)

type Server struct {
	router         chi.Router
	sessionManager *scs.SessionManager
	queries        *store.Queries
	authService    *service.AuthService
	requestService *service.RequestService
	actionService  *service.ActionService
}

func NewServer(pool *pgxpool.Pool, sessionStore scs.Store, corsOrigin string, secure bool) *Server {
	queries := store.New(pool)

	s := &Server{
		sessionManager: setupSessionManager(sessionStore),
		queries:        queries,
		authService:    service.NewAuthService(queries),
		requestService: service.NewRequestService(queries),
		actionService:  service.NewActionService(queries),
	}

	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(slogMiddleware)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{corsOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-CSRF-Token", "Idempotency-Key"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(s.sessionManager.LoadAndSave)
	r.Use(csrfMiddleware)

	rlm := newRateLimiterMap()

	// Public routes
	r.Get("/api/csrf", handleCSRF(secure))
	r.Post("/api/auth/signup", s.handleSignup())
	r.Post("/api/auth/login", s.handleLogin())

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(requireAuth(s.sessionManager))

		r.Get("/api/auth/me", s.handleMe())
		r.Post("/api/auth/logout", s.handleLogout())

		r.Post("/api/requests", s.handleCreateRequest())
		r.Get("/api/requests", s.handleListRequests())
		r.Get("/api/requests/{id}", s.handleGetRequest())
		r.Get("/api/requests/by-token/{shareToken}", s.handleGetRequestByToken())

		// Rate-limited action endpoints
		r.Group(func(r chi.Router) {
			r.Use(rateLimitMiddleware(rlm))
			r.Post("/api/requests/{id}/pay", s.handlePayRequest())
			r.Post("/api/requests/{id}/decline", s.handleDeclineRequest())
			r.Post("/api/requests/{id}/cancel", s.handleCancelRequest())
		})
	})

	s.router = r
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.router.ServeHTTP(w, r)
}

func slogMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"duration", time.Since(start),
		)
	})
}
