package config

import (
	"fmt"
	"os"
)

type Config struct {
	DatabaseURL   string
	Port          string
	SessionSecret string
	CORSOrigin    string
	Environment   string
}

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/cash_request?sslmode=disable"),
		Port:          getEnv("PORT", "8080"),
		SessionSecret: getEnv("SESSION_SECRET", ""),
		CORSOrigin:    getEnv("CORS_ORIGIN", "http://localhost:5173"),
		Environment:   getEnv("ENVIRONMENT", "development"),
	}

	if cfg.SessionSecret == "" {
		return nil, fmt.Errorf("SESSION_SECRET is required")
	}

	return cfg, nil
}

func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
