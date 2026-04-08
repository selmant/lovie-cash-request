import { useState } from "react";
import { useNavigate } from "react-router";
import { api, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { RequestResponse } from "@/types";

function detectRecipientType(value: string): "email" | "phone" | "unknown" {
  if (value.startsWith("+")) return "phone";
  if (value.includes("@")) return "email";
  return "unknown";
}

export function Component() {
  const navigate = useNavigate();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setError(null);
    setLoading(true);

    const type = detectRecipientType(recipient);
    const body: Record<string, string> = { amount };
    if (type === "email" || type === "unknown") {
      body.recipient_email = recipient;
    }
    if (type === "phone") {
      body.recipient_phone = recipient;
    }
    if (note) body.note = note;

    try {
      const res = await api.post<RequestResponse>("/requests", body);
      toast.success("Request created!");
      navigate(`/requests/${res.request.id}`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.details) {
          setFieldErrors(err.details);
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>New Payment Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient (email or phone)</Label>
            <Input
              id="recipient"
              placeholder="friend@example.com or +14155551234"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={loading}
            />
            {fieldErrors.recipient_email && (
              <p className="text-sm text-destructive">{fieldErrors.recipient_email}</p>
            )}
            {fieldErrors.recipient_phone && (
              <p className="text-sm text-destructive">{fieldErrors.recipient_phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="pl-7"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
              />
            </div>
            {fieldErrors.amount && (
              <p className="text-sm text-destructive">{fieldErrors.amount}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="note">Note (optional)</Label>
              <span className="text-xs text-muted-foreground">{note.length}/500</span>
            </div>
            <textarea
              id="note"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="What's this for?"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              disabled={loading}
              maxLength={500}
            />
            {fieldErrors.note && (
              <p className="text-sm text-destructive">{fieldErrors.note}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading || !recipient || !amount}>
            {loading ? "Creating..." : "Send Request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
