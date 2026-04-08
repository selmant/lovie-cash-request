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
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) return;

    setLoading(true);
    setError(null);

    api
      .get<RequestResponse>(`/requests/by-token/${token}`)
      .then((res) => {
        setRequestId(res.request.id);
      })
      .catch((err) => {
        if (err instanceof ApiRequestError) {
          if (err.code === "FORBIDDEN" || err.code === "NOT_FOUND") {
            setError(err.message);
            return;
          }
        }

        navigate("/", { replace: true });
      })
      .finally(() => setLoading(false));
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-64 w-full max-w-md" />
      </div>
    );
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

  return null;
}
