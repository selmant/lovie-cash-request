const API_BASE = "/api";

function getCSRFToken(): string {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

interface ApiError {
  error: string;
  code: string;
  details?: Record<string, string>;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public details?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (method !== "GET") {
    headers["X-CSRF-Token"] = getCSRFToken();
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err: ApiError = await res.json();
    throw new ApiRequestError(res.status, err.error, err.code, err.details);
  }

  return res.json() as Promise<T>;
}

function requestWithIdempotency<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-CSRF-Token": getCSRFToken(),
    "Idempotency-Key": crypto.randomUUID(),
  };

  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    if (!res.ok) {
      const err: ApiError = await res.json();
      throw new ApiRequestError(res.status, err.error, err.code, err.details);
    }
    return res.json() as Promise<T>;
  });
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  postIdempotent: <T>(path: string, body?: unknown) =>
    requestWithIdempotency<T>("POST", path, body),
};
