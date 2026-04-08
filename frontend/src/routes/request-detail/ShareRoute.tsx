import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import type { RequestResponse } from "@/types";

export function Component() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) return;

    setLoading(true);

    api
      .get<RequestResponse>(`/requests/by-token/${token}`)
      .then((res) => {
        setRequestId(res.request.id);
      })
      .catch(() => {
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

  return null;
}
