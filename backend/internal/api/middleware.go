package api

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"golang.org/x/time/rate"
)

type contextKey string

const userIDKey contextKey = "userID"

func setupSessionManager(store scs.Store) *scs.SessionManager {
	sm := scs.New()
	sm.Store = store
	sm.Lifetime = 24 * time.Hour
	sm.Cookie.Persist = true
	sm.Cookie.SameSite = http.SameSiteLaxMode
	sm.Cookie.HttpOnly = true
	return sm
}

func requireAuth(sm *scs.SessionManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userIDStr := sm.GetString(r.Context(), "userID")
			if userIDStr == "" {
				writeError(w, http.StatusUnauthorized, "Not authenticated", "UNAUTHORIZED")
				return
			}
			userID, err := uuid.Parse(userIDStr)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "Invalid session", "UNAUTHORIZED")
				return
			}
			ctx := context.WithValue(r.Context(), userIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func getUserID(ctx context.Context) uuid.UUID {
	return ctx.Value(userIDKey).(uuid.UUID)
}

// Rate limiter: 10 requests per minute per user
type rateLimiterMap struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
}

func newRateLimiterMap() *rateLimiterMap {
	return &rateLimiterMap{
		limiters: make(map[string]*rate.Limiter),
	}
}

func (rl *rateLimiterMap) getLimiter(key string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limiter, exists := rl.limiters[key]
	if !exists {
		limiter = rate.NewLimiter(rate.Every(6*time.Second), 10) // 10 req/min
		rl.limiters[key] = limiter
	}
	return limiter
}

func rateLimitMiddleware(rlm *rateLimiterMap) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := r.Context().Value(userIDKey).(uuid.UUID)
			key := r.RemoteAddr
			if ok {
				key = userID.String()
			}

			if !rlm.getLimiter(key).Allow() {
				writeError(w, http.StatusTooManyRequests, "Rate limit exceeded. Please try again later.", "RATE_LIMITED")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
