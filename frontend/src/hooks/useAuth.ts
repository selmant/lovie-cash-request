import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import type { User, UserResponse, CSRFResponse } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signup: (email: string, phone: string) => Promise<void>;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useAuthProvider() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch CSRF token first, then check auth
    api
      .get<CSRFResponse>("/csrf")
      .then(() => api.get<UserResponse>("/auth/me"))
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signup = useCallback(async (email: string, phone: string) => {
    const res = await api.post<UserResponse>("/auth/signup", { email, phone: phone || undefined });
    setUser(res.user);
  }, []);

  const login = useCallback(async (email: string) => {
    const res = await api.post<UserResponse>("/auth/login", { email });
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  return { user, loading, signup, login, logout };
}

export function isApiError(err: unknown): err is ApiRequestError {
  return err instanceof ApiRequestError;
}
