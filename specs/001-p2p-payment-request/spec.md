# Feature Specification: P2P Payment Request

**Feature Branch**: `001-p2p-payment-request`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "P2P Payment Request feature for consumer fintech app - request money from friends with creation flow, management dashboard, detail view, payment fulfillment simulation, and request expiration"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and View a Payment Request (Priority: P1)

A user wants to request money from a friend. They navigate to the
"New Request" form, enter the recipient's email, specify the
amount, and optionally add a note (e.g., "Dinner last night").
The system validates the inputs, creates the request, and provides
a unique shareable link. The user can then see this request in
their outgoing requests list.

**Why this priority**: This is the foundational action — without
request creation there is no feature. It also proves the core data
model and API work end-to-end.

**Independent Test**: Create a request via the form and verify it
appears in the outgoing requests list with status "Pending" and a
valid shareable link.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the New Request page,
   **When** they enter a valid email, amount of $25.00, and
   note "Lunch",
   **Then** the system creates a request with status "Pending",
   assigns a unique ID and shareable link, and redirects to the
   request detail view.

2. **Given** a logged-in user on the New Request page,
   **When** they enter an amount of $0 or negative,
   **Then** the system displays a validation error and does not
   create a request.

3. **Given** a logged-in user on the New Request page,
   **When** they enter an invalid email format (e.g., "notanemail"),
   **Then** the system displays a validation error for the
   recipient field.

4. **Given** a logged-in user on the New Request page,
   **When** they enter an amount exceeding $10,000.00,
   **Then** the system displays a validation error indicating the
   maximum allowed amount.

5. **Given** a logged-in user on the New Request page,
   **When** they submit the form without filling in the note,
   **Then** the system creates the request successfully (note is
   optional).

6. **Given** a logged-in user on the New Request page,
   **When** they enter an amount with more than 2 decimal places
   (e.g., $10.999),
   **Then** the system rejects the input with a validation error
   "Amount must have at most 2 decimal places."

7. **Given** a logged-in user on the New Request page,
   **When** they enter their own email as the recipient,
   **Then** the system rejects the request with an error
   "You cannot request money from yourself."

8. **Given** a created request with a shareable link,
   **When** an unauthenticated user opens the link,
   **Then** they are redirected to the login page with the
   shareable link preserved as a redirect target. After login,
   they are redirected back to the request detail view.

9. **Given** a created request with a shareable link,
   **When** a logged-in recipient opens the link,
   **Then** they see the request detail view with Pay and Decline
   options.

10. **Given** a created request with a shareable link,
    **When** a logged-in user who is neither sender nor recipient
    opens the link,
    **Then** the system displays a "Not authorized to view this
    request" message.

---

### User Story 2 - Pay, Decline, or Cancel a Request (Priority: P2)

A user receives a payment request from a friend (visible in their
incoming requests). They can view the request details and choose
to pay or decline. If they pay, the system simulates payment
processing with a 2-3 second loading state, then confirms success.
The sender can also cancel a pending request they created.

All state-mutating actions (pay, decline, cancel) MUST include a
client-generated idempotency key (UUID) in the request header to
prevent duplicate processing.

**Why this priority**: This is the core transaction flow. Without
pay/decline/cancel, requests have no resolution path.

**Independent Test**: Create a request between two users, then
have the recipient pay it. Verify status updates to "Paid" on
both the sender's outgoing list and recipient's incoming list.

**Acceptance Scenarios**:

1. **Given** a logged-in user with a pending incoming request,
   **When** they click "Pay",
   **Then** the system shows a loading/processing state for 2-3
   seconds, then displays a success confirmation, and the request
   status changes to "Paid".

2. **Given** a logged-in user with a pending incoming request,
   **When** they click "Decline",
   **Then** the request status changes to "Declined" immediately,
   and the sender sees the updated status in their outgoing list.

3. **Given** a logged-in user who created a pending outgoing
   request,
   **When** they click "Cancel",
   **Then** the request status changes to "Cancelled" and the
   recipient can no longer pay or decline it.

4. **Given** a request with status "Paid",
   **When** any user views the request detail,
   **Then** no action buttons (Pay, Decline, Cancel) are shown —
   only the final status.

5. **Given** a request with status "Declined", "Cancelled", or
   "Expired",
   **When** any user views the request detail,
   **Then** no action buttons are shown — only the final status.

6. **Given** a logged-in user clicking "Pay" on an incoming
   request,
   **When** they click "Pay" again rapidly (double-click),
   **Then** the system processes the payment only once. The second
   request with the same idempotency key returns the same
   successful result without side effects.

7. **Given** a logged-in user clicking "Decline" on an incoming
   request,
   **When** the same decline request is sent twice (same
   idempotency key),
   **Then** the system processes the decline only once.

8. **Given** two users attempting to act on the same pending
   request simultaneously (e.g., recipient pays while sender
   cancels),
   **When** both requests reach the server concurrently,
   **Then** the first request succeeds and the second receives
   HTTP 409 Conflict with a clear error message. The frontend
   displays a notification and refreshes the request state.

---

### User Story 3 - Dashboard with Filters and Search (Priority: P3)

A user wants to manage all their payment requests from a single
dashboard. The dashboard shows two sections: outgoing requests
(sent by user) and incoming requests (received by user). Users
can filter by status (Pending, Paid, Declined, Expired,
Cancelled) and search by recipient or sender email. Requests are
sorted by creation date, most recent first.

**Why this priority**: The dashboard aggregates all request data.
It depends on US1 and US2 being functional first, and adds a
management layer on top.

**Independent Test**: Seed several requests with different
statuses, then verify filtering by "Pending" shows only pending
requests and searching by email narrows results correctly.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the dashboard,
   **When** the page loads,
   **Then** they see two tabs/sections: "Outgoing" and "Incoming"
   with all their requests listed, sorted by creation date
   descending (most recent first).

2. **Given** a logged-in user on the dashboard with requests in
   multiple statuses,
   **When** they select the "Pending" status filter,
   **Then** only pending requests are displayed.

3. **Given** a logged-in user on the dashboard,
   **When** they type a recipient's email in the search bar,
   **Then** the list filters to show only requests matching that
   email (partial match).

4. **Given** a logged-in user on the dashboard,
   **When** they combine a status filter with a search term,
   **Then** both filters apply simultaneously.

5. **Given** a logged-in user on the dashboard on a mobile device,
   **When** they view the page,
   **Then** the layout adapts to a single-column view with the
   same filter and search functionality accessible.

6. **Given** a logged-in user on the dashboard,
   **When** no requests match the current filters,
   **Then** an empty state message "No requests match your
   filters" is displayed.

---

### User Story 4 - Request Expiration (Priority: P4)

Payment requests that remain pending for more than 7 days
automatically expire. Expiration is determined at query time:
the system treats any pending request whose `expires_at` timestamp
is in the past as expired. No background process is required. The
request detail view shows an expiration countdown for pending
requests. Expired requests cannot be paid or declined.

**Why this priority**: Expiration is a business rule that prevents
stale requests from lingering. It depends on the core request
lifecycle (US1, US2) being in place.

**Independent Test**: Create a request, artificially advance time
past 7 days (or seed an old request), and verify the status shows
"Expired" with no Pay/Decline buttons available.

**Acceptance Scenarios**:

1. **Given** a pending request created 6 days ago,
   **When** a user views the request detail,
   **Then** they see a countdown showing time remaining. When more
   than 24 hours remain, display days (e.g., "Expires in 2 days").
   When under 24 hours, display hours and minutes (e.g., "Expires
   in 5h 32m").

2. **Given** a pending request whose `expires_at` is in the past,
   **When** any API endpoint reads this request,
   **Then** the system returns the status as "Expired" (derived
   at query time from `WHERE status = 'pending' AND expires_at <
   now()`). The database row retains `status = 'pending'` — the
   API layer derives "Expired" for display.

3. **Given** an expired request,
   **When** the recipient attempts to pay,
   **Then** the API checks `expires_at` before processing. If
   expired, the system blocks the action, returns an error, and
   the frontend displays "This request has expired."

4. **Given** an expired request,
   **When** any user views the request detail,
   **Then** no action buttons are shown, and the status displays
   "Expired" with the original expiration date.

5. **Given** a pending request and a concurrent cancel attempt
   arriving after the expiration time,
   **When** the cancel request reaches the server,
   **Then** the system checks `expires_at` first. If expired,
   the cancel is rejected (request is already terminal). No
   conflict between expiration and cancel can occur since
   expiration is query-derived, not a write operation.

---

### User Story 5 - User Authentication (Priority: P1)

Users must authenticate before accessing any feature. The system
uses simple email-based mock authentication — a user enters their
email and is immediately logged in (no password, no magic link
verification in this prototype). This enables multi-user testing
where different browser sessions represent different users.

**Why this priority**: Authentication is a prerequisite for all
other stories — the system must know who the sender and recipient
are.

**Independent Test**: Enter an email on the login page, verify
redirect to dashboard, and confirm the session persists across
page navigation.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user visiting any page,
   **When** the page loads,
   **Then** they are redirected to the login page. If the original
   URL was a shareable link or specific page, it is preserved as
   a redirect target (e.g., `/login?redirect=/r/abc123`).

2. **Given** a user on the login page,
   **When** they enter a valid email and submit,
   **Then** they are logged in, a session is created, and they
   are redirected to the dashboard (or to the preserved redirect
   target if one exists).

3. **Given** a logged-in user,
   **When** they click "Log out",
   **Then** the session is destroyed and they are redirected to
   the login page.

4. **Given** a logged-in user,
   **When** they navigate between pages,
   **Then** their session persists and they remain authenticated.

---

### Edge Cases

- What happens when a user requests money from their own email?
  System MUST reject self-requests with a clear error message.
  The check compares the sender's email against the recipient
  email field at creation time.
- What happens when a recipient is not a registered user?
  The request is created with the recipient's email. When that
  person registers and logs in with the same email, they see the
  pending request in their incoming list (matched by email).
- What happens if the server is unreachable during "Pay" action?
  The frontend displays an error toast and does not change the
  request status. The user can retry with the same idempotency
  key.
- What happens when filtering returns zero results?
  The dashboard displays an empty state message: "No requests
  match your filters."
- What happens if a user opens a shareable link for a request
  that does not belong to them (they are neither sender nor
  recipient)? The system shows a "Not authorized" message.
- What happens when the amount has more than 2 decimal places
  (e.g., $10.999)? The system rejects the input with a
  validation error. No silent rounding.
- What happens when an unauthenticated user opens a shareable
  link? They are redirected to login with the link preserved.
  After login, they are redirected back to the request view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to create
  payment requests by specifying a recipient email, amount (in
  USD), and an optional note.
- **FR-002**: System MUST validate that the amount is greater than
  $0.00, does not exceed $10,000.00, and has at most 2 decimal
  places. Amounts with more than 2 decimal places MUST be
  rejected (no silent rounding).
- **FR-003**: System MUST validate recipient contact format as a
  valid email address per RFC 5322.
- **FR-004**: System MUST reject requests where the sender's email
  matches the recipient email field (self-request prevention).
- **FR-005**: System MUST generate a unique shareable link for
  each payment request using a cryptographically random token.
- **FR-006**: System MUST store amounts as integer cents internally
  to avoid floating-point precision errors.
- **FR-007**: System MUST display a management dashboard with
  separate views for outgoing (sent) and incoming (received)
  requests, sorted by creation date descending.
- **FR-008**: System MUST support filtering requests by status:
  Pending, Paid, Declined, Expired, Cancelled.
- **FR-009**: System MUST support searching requests by
  recipient/sender email (partial match).
- **FR-010**: System MUST display request details including amount,
  note, sender info, recipient info, creation timestamp, and
  current status.
- **FR-011**: System MUST display "Pay" and "Decline" action
  buttons for pending (non-expired) incoming requests only.
- **FR-012**: System MUST display a "Cancel" action for pending
  (non-expired) outgoing requests only.
- **FR-013**: System MUST simulate payment processing with a 2-3
  second loading state before confirming success.
- **FR-014**: System MUST enforce idempotent processing for all
  state-mutating actions (pay, decline, cancel). Each action
  MUST include a client-generated idempotency key (UUID) in the
  request header. Duplicate requests with the same idempotency
  key MUST return the same result without side effects.
- **FR-015**: System MUST update request status atomically using
  optimistic locking. Both sender and recipient dashboards
  reflect the updated status on their next page load or
  navigation.
- **FR-016**: System MUST treat pending requests as expired when
  their `expires_at` timestamp (creation + 7 days) is in the
  past. Expiration is derived at query time — no background
  process is required.
- **FR-017**: System MUST display an expiration countdown on
  pending request detail views. Display days when >24h remain,
  hours and minutes when <24h remain.
- **FR-018**: System MUST block pay/decline/cancel actions on
  expired requests by checking `expires_at` before processing
  any state mutation.
- **FR-019**: System MUST provide email-based mock authentication
  (email entry, session creation, logout).
- **FR-020**: System MUST redirect unauthenticated users to the
  login page, preserving the original URL as a redirect target
  so users return to their intended page after login.
- **FR-021**: System MUST work responsively on mobile (320px+)
  and desktop (1024px+) viewports.
- **FR-022**: System MUST return HTTP 409 Conflict when concurrent
  state mutations are detected on the same request (optimistic
  locking violation).
- **FR-023**: System MUST enforce CSRF protection on all
  state-changing endpoints (create, pay, decline, cancel, login,
  logout).
- **FR-024**: System MUST enforce rate limiting on payment-mutating
  endpoints (pay, decline, cancel) at a minimum of 10 requests
  per minute per authenticated user. Exceeding the limit MUST
  return HTTP 429 Too Many Requests.

### Key Entities

- **User**: Represents an authenticated person. Key attributes:
  unique ID, email, display name (derived from email), creation
  timestamp. A user can be both a sender and recipient across
  different requests.
- **PaymentRequest**: The core domain object. Key attributes:
  unique ID, sender (user reference), recipient email, recipient
  user (resolved when a user with matching email registers or
  logs in), amount in cents, note (optional), status (Pending,
  Paid, Declined, Cancelled — note: "Expired" is not stored but
  derived at query time from `expires_at`), shareable token
  (cryptographically random), creation timestamp, expiration
  timestamp (`expires_at` = creation + 7 days), version (integer,
  incremented on each state mutation for optimistic locking).

### State Machine

Valid state transitions for PaymentRequest status:

```
Pending -> Paid       (recipient pays)
Pending -> Declined   (recipient declines)
Pending -> Cancelled  (sender cancels)
Pending -> [Expired]  (derived: expires_at < now())
```

Terminal states: Paid, Declined, Cancelled, Expired.
No transitions are allowed from any terminal state.
"Expired" is not a stored status — it is derived at query time.
All mutation endpoints MUST check both stored status = Pending
AND expires_at > now() before allowing any transition.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a payment request and receive a
  shareable link in under 5 seconds from form submission.
- **SC-002**: Payment fulfillment (Pay action) completes within
  5 seconds including the simulated processing delay.
- **SC-003**: Dashboard loads and displays up to 50 requests
  within 2 seconds.
- **SC-004**: Status filter and search results update within
  1 second of user input.
- **SC-005**: All 5 request statuses (Pending, Paid, Declined,
  Expired, Cancelled) are correctly reflected in both sender
  and recipient views upon page load or navigation.
- **SC-006**: The application is fully usable on a 320px-wide
  mobile viewport with no horizontal scrolling or overlapping
  elements.
- **SC-007**: Duplicate rapid Pay/Decline/Cancel clicks result in
  exactly one state mutation processed.
- **SC-008**: Expired requests (7+ days old) cannot be paid,
  declined, or cancelled under any circumstances.

## Assumptions

- Users have stable internet connectivity (no offline mode).
- The application operates in USD only — no multi-currency
  support.
- "Mock auth" means entering an email immediately logs the user
  in. No password, no email verification, no magic link delivery.
  This is sufficient for the prototype to demonstrate multi-user
  flows.
- Recipients are identified by email only. Phone number support
  is excluded from this prototype because users authenticate by
  email — a phone-number recipient could never be resolved to a
  user account.
- A recipient who is not yet registered will have their request
  waiting for them upon registration. The system matches by
  email: when a new user logs in, any PaymentRequest with a
  matching `recipient_email` is linked to their account. No push
  notification or email notification is sent (out of scope).
- The payment simulation does not interact with any real payment
  processor — it is a timed delay followed by a status update.
- The shareable link is publicly accessible but only authorized
  parties (sender or recipient) can take actions on the request.
  Unauthenticated users opening a shareable link are redirected
  to login with the link preserved for post-login redirect.
- Request pagination is not required for the prototype (dashboard
  shows all requests). Can be added later if needed.
- The 7-day expiration is calculated from request creation
  timestamp, not from any subsequent event. Expiration is derived
  at query time, not stored as a status.
- The system assumes a single-tenant deployment (one app instance
  serving all users) — no multi-tenancy.
- Dashboard status updates are reflected on page load/navigation
  (no real-time push via WebSockets or SSE). This is sufficient
  for the prototype scope.
