export interface User {
  id: string;
  email: string;
  phone: string | null;
  display_name: string;
  created_at: string;
}

export type RequestStatus = "pending" | "paid" | "declined" | "expired" | "cancelled";

export interface PaymentRequestSender {
  id: string;
  email: string;
  display_name: string;
}

export interface PaymentRequestRecipient {
  id: string;
  email: string;
  phone: string | null;
  display_name: string;
}

export interface PaymentRequest {
  id: string;
  sender: PaymentRequestSender;
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient: PaymentRequestRecipient | null;
  amount_minor: number;
  amount_display: string;
  note: string | null;
  status: RequestStatus;
  share_token: string;
  share_url: string;
  expires_at: string;
  created_at: string;
}

export interface ApiResponse<T> {
  [key: string]: T;
}

export interface UserResponse {
  user: User;
}

export interface RequestResponse {
  request: PaymentRequest;
}

export interface RequestListResponse {
  requests: PaymentRequest[];
}

export interface CSRFResponse {
  token: string;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "EXPIRED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";
