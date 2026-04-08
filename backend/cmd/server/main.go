package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/alexedwards/scs/pgxstore"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pressly/goose/v3"
	"github.com/selmant/cash-request/backend/internal/api"
	"github.com/selmant/cash-request/backend/internal/config"

	// Import for goose migration driver
	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	ctx := context.Background()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("connected to database")

	// Run migrations
	if err := runMigrations(cfg.DatabaseURL); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	sessionStore := pgxstore.New(pool)

	server := api.NewServer(pool, sessionStore, cfg.CORSOrigin, !cfg.IsDevelopment())

	httpServer := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: server,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("server starting", "port", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "error", err)
	}
}

func runMigrations(databaseURL string) error {
	db, err := goose.OpenDBWithDriver("pgx", databaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	return goose.Up(db, "internal/db/migrations")
}
