import { use, Suspense } from "react";
import { useParams, Navigate } from "react-router";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import type { RequestResponse } from "@/types";

type ShareResult =
  | { type: "redirect"; id: string }
  | { type: "error"; message: string }
  | { type: "home" };

const cache = new Map<string, Promise<ShareResult>>();

function fetchShareResult(token: string): Promise<ShareResult> {
  if (!cache.has(token)) {
    cache.set(
      token,
      api
        .get<RequestResponse>(`/requests/by-token/${token}`)
        .then((res): ShareResult => ({ type: "redirect", id: res.request.id }))
        .catch((err): ShareResult => {
          if (err instanceof ApiRequestError) {
            if (err.code === "FORBIDDEN" || err.code === "NOT_FOUND") {
              return { type: "error", message: err.message };
            }
          }
          return { type: "home" };
        }),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guaranteed by has() check above
  return cache.get(token)!;
}

function ShareContent({ token }: { token: string }) {
  const result = use(fetchShareResult(token));

  // Clean up cache after resolution
  cache.delete(token);

  if (result.type === "redirect") {
    return <Navigate to={`/requests/${result.id}`} replace />;
  }

  if (result.type === "error") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="p-6 text-center text-destructive">{result.message}</CardContent>
      </Card>
    );
  }

  return <Navigate to="/" replace />;
}

export function Component() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-64 w-full max-w-md" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=/r/${token}`} replace />;
  }

  if (!token) return null;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Skeleton className="h-64 w-full max-w-md" />
        </div>
      }
    >
      <ShareContent token={token} />
    </Suspense>
  );
}
