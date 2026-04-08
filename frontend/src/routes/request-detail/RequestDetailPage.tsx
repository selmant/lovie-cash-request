import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { PaymentRequest, RequestResponse } from "@/types";

function statusVariant(status: string) {
  switch (status) {
    case "pending":
      return "secondary" as const;
    case "paid":
      return "default" as const;
    case "declined":
    case "cancelled":
    case "expired":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function Component() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .get<RequestResponse>(`/requests/${id}`)
      .then((res) => setRequest(res.request))
      .catch(() => toast.error("Failed to load request"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!request) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="p-6 text-center text-muted-foreground">
          Request not found
        </CardContent>
      </Card>
    );
  }

  const shareUrl = `${window.location.origin}${request.share_url}`;

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Payment Request</CardTitle>
          <Badge variant={statusVariant(request.status)}>
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-3xl font-bold">{request.amount_display}</p>
        </div>

        <div className="space-y-2 rounded-md bg-muted p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">From</span>
            <span>{request.sender.display_name} ({request.sender.email})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">To</span>
            <span>
              {request.recipient
                ? `${request.recipient.display_name} (${request.recipient.email})`
                : request.recipient_email || request.recipient_phone}
            </span>
          </div>
          {request.note && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Note</span>
              <span className="text-right max-w-[60%]">{request.note}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>{new Date(request.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Expires</span>
            <span>{new Date(request.expires_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Shareable Link</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                toast.success("Link copied!");
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
