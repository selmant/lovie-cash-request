import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import type { RequestResponse } from "@/types";

export function Component() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || !token) return;
    let cancelled = false;

    api
      .get<RequestResponse>(`/requests/by-token/${token}`)
      .then((res) => {
        if (!cancelled) setRequestId(res.request.id);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError) {
          if (err.code === "FORBIDDEN" || err.code === "NOT_FOUND") {
            setError(err.message);
            return;
          }
        }
        navigate("/", { replace: true });
      });

    return () => { cancelled = true; };
  }, [token, user, authLoading, navigate]);

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

  if (requestId) {
    return <Navigate to={`/requests/${requestId}`} replace />;
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="p-6 text-center text-destructive">{error}</CardContent>
      </Card>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Skeleton className="h-64 w-full max-w-md" />
    </div>
  );
}
