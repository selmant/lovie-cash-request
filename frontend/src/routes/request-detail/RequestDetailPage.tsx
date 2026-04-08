import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router";
import { api, ApiRequestError } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

function ExpirationCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return <span className="text-destructive font-medium">Expired</span>;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (days > 0) return <span>{days}d {hours}h remaining</span>;
  return <span className="text-orange-500">{hours}h {minutes}m remaining</span>;
}

export function Component() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequest = useCallback(() => {
    if (!id) return;
    api
      .get<RequestResponse>(`/requests/${id}`)
      .then((res) => setRequest(res.request))
      .catch(() => toast.error("Failed to load request"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchRequest(); }, [fetchRequest]);

  const handleAction = async (action: "pay" | "decline" | "cancel") => {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await api.postIdempotent<RequestResponse>(`/requests/${id}/${action}`);
      setRequest(res.request);
      const labels = { pay: "Paid", decline: "Declined", cancel: "Cancelled" };
      toast.success(`Request ${labels[action].toLowerCase()}!`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === "CONFLICT") toast.error("Request has already been modified. Please refresh.");
        else if (err.code === "EXPIRED") toast.error("This request has expired.");
        else if (err.code === "RATE_LIMITED") toast.error("Too many requests. Please try again later.");
        else toast.error(err.message);
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
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
        <CardContent className="p-6 text-center text-muted-foreground">Request not found</CardContent>
      </Card>
    );
  }

  const isSender = user?.id === request.sender.id;
  const isRecipient = user?.id === request.recipient?.id ||
    user?.email === request.recipient_email ||
    (user?.phone && user.phone === request.recipient_phone);
  const isPending = request.status === "pending";
  const isExpired = request.status === "expired";
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
            {isPending ? (
              <ExpirationCountdown expiresAt={request.expires_at} />
            ) : (
              <span>{new Date(request.expires_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {isExpired && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">
            This request has expired
          </div>
        )}

        {isPending && isRecipient && (
          <div className="flex gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="flex-1" disabled={actionLoading}>
                  {actionLoading ? "Processing..." : "Pay"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Pay {request.amount_display} to {request.sender.display_name}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleAction("pay")}>Pay</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" className="flex-1" disabled={actionLoading} onClick={() => handleAction("decline")}>
              Decline
            </Button>
          </div>
        )}

        {isPending && isSender && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={actionLoading}>
                Cancel Request
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Request</AlertDialogTitle>
                <AlertDialogDescription>
                  Cancel this {request.amount_display} request? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Request</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleAction("cancel")}>Cancel Request</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

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
