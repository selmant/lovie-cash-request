import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { api } from "@/lib/api-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentRequest, RequestListResponse } from "@/types";

function statusVariant(status: string) {
  switch (status) {
    case "pending": return "secondary" as const;
    case "paid": return "default" as const;
    default: return "destructive" as const;
  }
}

export function Component() {
  const [direction, setDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ direction });
    if (status !== "all") params.set("status", status);
    if (search) params.set("search", search);

    api
      .get<RequestListResponse>(`/requests?${params}`)
      .then((res) => setRequests(res.requests))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [direction, status, search]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link to="/new">New Request</Link>
        </Button>
      </div>

      <Tabs value={direction} onValueChange={(v) => setDirection(v as "outgoing" | "incoming")}>
        <TabsList>
          <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
          <TabsTrigger value="incoming">Incoming</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Status filter">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Search by email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>

        <TabsContent value={direction}>
          {loading ? (
            <div className="space-y-3 mt-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="mt-8 text-center text-muted-foreground">
              No requests match your filters
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  to={`/requests/${req.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {direction === "outgoing"
                        ? (req.recipient?.email || req.recipient_email || req.recipient_phone)
                        : req.sender.email}
                    </span>
                    {req.note && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {req.note}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold">{req.amount_display}</span>
                    <Badge variant={statusVariant(req.status)}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
