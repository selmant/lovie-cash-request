# Feature Specification: P2P Payment Request

**Feature Branch**: `001-p2p-payment-request`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "P2P Payment Request feature for consumer fintech app - request money from friends with creation flow, management dashboard, detail view, payment fulfillment simulation, and request expiration"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and View a Payment Request (Priority: P1)

A user wants to request money from a friend. They navigate to the
"New Request" form, enter the recipient's email or phone number,
specify the amount, and optionally add a note (e.g., "Dinner last
night"). The system validates the inputs, creates the request, and
provides a unique shareable link. The user can then see this
request in their outgoing requests list.

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
   **When** they enter a valid phone number (e.g., "+1234567890"),
   **Then** the system accepts it as a valid recipient and creates
   the request.

5. **Given** a logged-in user on the New Request page,
   **When** they enter an amount exceeding $10,000.00,
   **Then** the system displays a validation error indicating the
   maximum allowed amount.

6. **Given** a logged-in user on the New Request page,
   **When** they submit the form without filling in the note,
   **Then** the system creates the request successfully (note is
   optional).

7. **Given** a created request with a shareable link,
   **When** a recipient opens the link while logged in,
   **Then** they see the request detail view with Pay and Decline
   options.

---

### User Story 2 - Pay, Decline, or Cancel a Request (Priority: P2)

A user receives a payment request from a friend (visible in their
incoming requests). They can view the request details and choose
to pay or decline. If they pay, the system simulates payment
processing with a 2-3 second loading state, then confirms success.
The sender can also cancel a pending request they created.

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

5. **Given** a request with status "Declined" or "Cancelled",
   **When** any user views the request detail,
   **Then** no action buttons are shown — only the final status.

6. **Given** a logged-in user clicking "Pay" on an incoming request,
   **When** they click "Pay" again rapidly (double-click),
   **Then** the system processes the payment only once (idempotent).

---

### User Story 3 - Dashboard with Filters and Search (Priority: P3)

A user wants to manage all their payment requests from a single
dashboard. The dashboard shows two sections: outgoing requests
(sent by user) and incoming requests (received by user). Users
can filter by status (Pending, Paid, Declined, Expired) and
search by recipient or sender name/email.

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
   with all their requests listed, most recent first.

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

---

### User Story 4 - Request Expiration (Priority: P4)

Payment requests that remain pending for more than 7 days
automatically expire. The request detail view shows an expiration
countdown for pending requests. Expired requests cannot be paid
or declined.

**Why this priority**: Expiration is a business rule that prevents
stale requests from lingering. It depends on the core request
lifecycle (US1, US2) being in place.

**Independent Test**: Create a request, artificially advance time
past 7 days (or seed an old request), and verify the status shows
"Expired" with no Pay/Decline buttons available.

**Acceptance Scenarios**:

1. **Given** a pending request created 6 days ago,
   **When** a user views the request detail,
   **Then** they see a countdown showing "Expires in 1 day".

2. **Given** a pending request created 7+ days ago,
   **When** the system checks for expiration (on page load or via
   background process),
   **Then** the request status changes to "Expired".

3. **Given** an expired request,
   **When** the recipient attempts to pay,
   **Then** the system blocks the action and displays "This request
   has expired".

4. **Given** an expired request,
   **When** any user views the request detail,
   **Then** no action buttons are shown, and the status displays
   "Expired" with the original expiration date.

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
   **Then** they are redirected to the login page.

2. **Given** a user on the login page,
   **When** they enter a valid email and submit,
   **Then** they are logged in, a session is created, and they
   are redirected to the dashboard.

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
- What happens when a recipient is not a registered user?
  The request is created with the recipient's contact info. When
  that person registers and logs in, they see the pending request
  in their incoming list.
- What happens if the server is unreachable during "Pay" action?
  The frontend displays an error toast and does not change the
  request status. The user can retry.
- What happens when filtering returns zero results?
  The dashboard displays an empty state message: "No requests
  match your filters."
- What happens if a user opens a shareable link for a request
  that does not belong to them (they are neither sender nor
  recipient)? The system shows a "Not authorized" message.
- What happens when the amount has more than 2 decimal places
  (e.g., $10.999)? The system rounds to 2 decimal places or
  rejects input with a validation error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to create
  payment requests by specifying a recipient (email or phone),
  amount (in USD), and an optional note.
- **FR-002**: System MUST validate that the amount is greater than
  $0.00 and does not exceed $10,000.00.
- **FR-003**: System MUST validate recipient contact format (valid
  email per RFC 5322 or E.164 phone number format).
- **FR-004**: System MUST reject requests where the sender and
  recipient are the same user.
- **FR-005**: System MUST generate a unique shareable link for
  each payment request using a cryptographically random token.
- **FR-006**: System MUST store amounts as integer cents internally
  to avoid floating-point precision errors.
- **FR-007**: System MUST display a management dashboard with
  separate views for outgoing (sent) and incoming (received)
  requests.
- **FR-008**: System MUST support filtering requests by status:
  Pending, Paid, Declined, Expired.
- **FR-009**: System MUST support searching requests by
  recipient/sender email or name (partial match).
- **FR-010**: System MUST display request details including amount,
  note, sender info, recipient info, creation timestamp, and
  current status.
- **FR-011**: System MUST display "Pay" and "Decline" action
  buttons for pending incoming requests only.
- **FR-012**: System MUST display a "Cancel" action for pending
  outgoing requests only.
- **FR-013**: System MUST simulate payment processing with a 2-3
  second loading state before confirming success.
- **FR-014**: System MUST enforce idempotent payment processing —
  duplicate pay requests for the same request MUST be handled
  without double-processing.
- **FR-015**: System MUST update request status atomically and
  reflect changes in both sender and recipient dashboards.
- **FR-016**: System MUST automatically expire pending requests
  after 7 days from creation.
- **FR-017**: System MUST display an expiration countdown on
  pending request detail views.
- **FR-018**: System MUST block pay/decline actions on expired
  requests.
- **FR-019**: System MUST provide email-based mock authentication
  (email entry, session creation, logout).
- **FR-020**: System MUST redirect unauthenticated users to the
  login page.
- **FR-021**: System MUST work responsively on mobile (320px+)
  and desktop (1024px+) viewports.
- **FR-022**: System MUST return HTTP 409 Conflict when concurrent
  state mutations are detected on the same request.

### Key Entities

- **User**: Represents an authenticated person. Key attributes:
  unique ID, email, display name (derived from email), creation
  timestamp. A user can be both a sender and recipient across
  different requests.
- **PaymentRequest**: The core domain object. Key attributes:
  unique ID, sender (user reference), recipient contact (email or
  phone), recipient user (resolved when recipient registers),
  amount in cents, note (optional), status (Pending, Paid,
  Declined, Expired, Cancelled), shareable token, creation
  timestamp, expiration timestamp (creation + 7 days), version
  (for optimistic locking).

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
  Expired, Cancelled) are correctly reflected across both sender
  and recipient views within 3 seconds of the state change.
- **SC-006**: The application is fully usable on a 320px-wide
  mobile viewport with no horizontal scrolling or overlapping
  elements.
- **SC-007**: Duplicate rapid Pay clicks result in exactly one
  payment processed.
- **SC-008**: Expired requests (7+ days old) cannot be paid
  under any circumstances.

## Assumptions

- Users have stable internet connectivity (no offline mode).
- The application operates in USD only — no multi-currency support.
- "Mock auth" means entering an email immediately logs the user
  in. No password, no email verification, no magic link delivery.
  This is sufficient for the prototype to demonstrate multi-user
  flows.
- A recipient who is not yet registered will have their request
  waiting for them upon registration. No push notification or
  email notification is sent (out of scope for prototype).
- The payment simulation does not interact with any real payment
  processor — it is a timed delay followed by a status update.
- The shareable link is publicly accessible but only authorized
  parties (sender or recipient) can take actions on the request.
- Request pagination is not required for the prototype (dashboard
  shows all requests). Can be added later if needed.
- The 7-day expiration is calculated from request creation
  timestamp, not from any subsequent event.
- The system assumes a single-tenant deployment (one app instance
  serving all users) — no multi-tenancy.
