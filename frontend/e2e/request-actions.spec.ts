import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import {
  createRequest,
  makeUser,
  newUserPage,
  openRequest,
  postAction,
  signup,
} from "./helpers";

test.describe("request action scenarios", () => {
  test("preserves share-link redirects and lets the recipient pay a request with a visible delay", async ({
    browser,
    page,
  }) => {
    const sender = makeUser("pay-sender");
    const recipient = makeUser("pay-recipient");
    const note = "Lunch split";

    await signup(page, sender);
    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "25.00",
      note,
    });

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await recipientPage.goto(request.shareUrl);
    await expect(recipientPage).toHaveURL(/\/login\?redirect=/);

    await signup(recipientPage, recipient, { navigate: false });
    await expect(recipientPage).toHaveURL(new RegExp(`/requests/${request.id}$`));

    const requestDetail = recipientPage.getByRole("main");
    await expect(requestDetail.getByRole("button", { name: "Pay" })).toBeVisible();
    await expect(requestDetail.getByRole("button", { name: "Decline" })).toBeVisible();

    await requestDetail.getByRole("button", { name: "Pay" }).click();
    const payDialog = recipientPage.getByRole("alertdialog");
    const startedAt = Date.now();
    await payDialog.getByRole("button", { name: "Pay" }).click();
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Paid/);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1900);

    await expect(requestDetail.getByRole("button", { name: "Pay" })).toHaveCount(0);
    await expect(requestDetail.getByRole("button", { name: "Decline" })).toHaveCount(0);

    await recipientPage.goto("/");
    await recipientPage.getByRole("tab", { name: "Incoming" }).click();
    await recipientPage.getByPlaceholder("Search by email or phone...").fill(sender.email);
    await expect(recipientPage.getByText(note)).toBeVisible();
    await expect(recipientPage.locator('[aria-label="Request status paid"]')).toBeVisible();

    await page.goto("/");
    await page.getByPlaceholder("Search by email or phone...").fill(recipient.email);
    await expect(page.getByText(note)).toBeVisible();
    await expect(page.locator('[aria-label="Request status paid"]')).toBeVisible();

    await recipientContext.close();
  });

  test("lets recipients decline requests and reflects the terminal state for sender and recipient", async ({
    browser,
    page,
  }) => {
    const sender = makeUser("decline-sender");
    const recipient = makeUser("decline-recipient");
    const note = "Movie tickets";

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "18.00",
      note,
    });

    await recipientPage.goto(`/requests/${request.id}`);
    await recipientPage.getByRole("button", { name: "Decline" }).click();
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Declined/);
    await expect(recipientPage.getByRole("button", { name: "Pay" })).toHaveCount(0);
    await expect(recipientPage.getByRole("button", { name: "Decline" })).toHaveCount(0);

    await page.goto("/");
    await page.getByPlaceholder("Search by email or phone...").fill(recipient.email);
    await expect(page.getByText(note)).toBeVisible();
    await expect(page.locator('[aria-label="Request status declined"]')).toBeVisible();

    await openRequest(page, request.id);
    await expect(page.getByRole("button", { name: "Cancel Request" })).toHaveCount(0);

    await recipientContext.close();
  });

  test("lets senders cancel requests and removes recipient actions", async ({ browser, page }) => {
    const sender = makeUser("cancel-sender");
    const recipient = makeUser("cancel-recipient");
    const note = "Hotel split";

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "82.00",
      note,
    });

    await page.getByRole("button", { name: "Cancel Request" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel Request" }).click();
    await expect(page.locator('[aria-label="Request status"]')).toHaveText(/Cancelled/);

    await recipientPage.goto(request.shareUrl);
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Cancelled/);
    await expect(recipientPage.getByRole("button", { name: "Pay" })).toHaveCount(0);
    await expect(recipientPage.getByRole("button", { name: "Decline" })).toHaveCount(0);

    await recipientContext.close();
  });

  test("handles duplicate idempotent actions and concurrent conflicts", async ({ browser, page }) => {
    const sender = makeUser("idem-sender");
    const recipient = makeUser("idem-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const payRequest = await createRequest(page, {
      recipient: recipient.email,
      amount: "14.00",
      note: "Idempotent pay",
    });
    const payKey = randomUUID();
    const payResponses = await Promise.all([
      postAction(recipientPage, payRequest.id, "pay", payKey),
      postAction(recipientPage, payRequest.id, "pay", payKey),
    ]);
    expect(payResponses.map((response) => response.status)).toEqual([200, 200]);

    await openRequest(recipientPage, payRequest.id);
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Paid/);

    const declineRequest = await createRequest(page, {
      recipient: recipient.email,
      amount: "21.00",
      note: "Idempotent decline",
    });
    const declineKey = randomUUID();
    const declineResponses = await Promise.all([
      postAction(recipientPage, declineRequest.id, "decline", declineKey),
      postAction(recipientPage, declineRequest.id, "decline", declineKey),
    ]);
    expect(declineResponses.map((response) => response.status)).toEqual([200, 200]);

    await openRequest(recipientPage, declineRequest.id);
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Declined/);

    const conflictRequest = await createRequest(page, {
      recipient: recipient.email,
      amount: "33.00",
      note: "Conflict request",
    });
    const conflictResponses = await Promise.all([
      postAction(recipientPage, conflictRequest.id, "pay", randomUUID()),
      postAction(page, conflictRequest.id, "cancel", randomUUID()),
    ]);
    const statuses = conflictResponses.map((response) => response.status).sort((left, right) => left - right);
    expect(statuses).toEqual([200, 409]);

    await recipientContext.close();
  });

  test("shows an error toast and preserves pending status when pay fails over the network", async ({
    browser,
    page,
  }) => {
    const sender = makeUser("network-sender");
    const recipient = makeUser("network-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "19.00",
      note: "Network retry",
    });

    await recipientPage.goto(`/requests/${request.id}`);
    await recipientPage.route("**/api/requests/*/pay", async (route) => {
      await route.abort("failed");
    });

    await recipientPage.getByRole("button", { name: "Pay" }).click();
    await recipientPage.getByRole("alertdialog").getByRole("button", { name: "Pay" }).click();
    await expect(recipientPage.getByText(/unexpected error occurred/i)).toBeVisible();
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Pending/);

    await recipientPage.unroute("**/api/requests/*/pay");
    await recipientContext.close();
  });

  test("refreshes stale recipient views after sender-side conflicts", async ({ browser, page }) => {
    const sender = makeUser("conflict-sender");
    const recipient = makeUser("conflict-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "41.00",
      note: "UI conflict",
    });

    await recipientPage.goto(`/requests/${request.id}`);
    await expect(recipientPage.getByRole("button", { name: "Pay" })).toBeVisible();
    await postAction(page, request.id, "cancel", randomUUID());

    await recipientPage.getByRole("button", { name: "Pay" }).click();
    await recipientPage.getByRole("alertdialog").getByRole("button", { name: "Pay" }).click();
    await expect(recipientPage.getByText(/already been modified/i)).toBeVisible();
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Cancelled/);

    await recipientContext.close();
  });

  test("prevents sender from paying or declining their own request", async ({ page }) => {
    const sender = makeUser("self-act-sender");
    const recipient = makeUser("self-act-recipient");

    await signup(page, sender);
    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "20.00",
      note: "Self-action test",
    });

    const payResponse = await postAction(page, request.id, "pay", randomUUID());
    expect(payResponse.status).toBe(403);
    expect(payResponse.body).toMatchObject({ code: "FORBIDDEN" });

    const declineResponse = await postAction(page, request.id, "decline", randomUUID());
    expect(declineResponse.status).toBe(403);
    expect(declineResponse.body).toMatchObject({ code: "FORBIDDEN" });

    await openRequest(page, request.id);
    await expect(page.locator('[aria-label="Request status"]')).toHaveText(/Pending/);
  });

  test("prevents stranger from paying, declining, or cancelling a request", async ({
    browser,
    page,
  }) => {
    const sender = makeUser("stranger-sender");
    const recipient = makeUser("stranger-recipient");
    const stranger = makeUser("stranger-user");

    const { context: strangerContext, page: strangerPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(strangerPage, stranger);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "30.00",
      note: "Stranger test",
    });

    const payResponse = await postAction(strangerPage, request.id, "pay", randomUUID());
    expect(payResponse.status).toBe(403);
    expect(payResponse.body).toMatchObject({ code: "FORBIDDEN" });

    const declineResponse = await postAction(strangerPage, request.id, "decline", randomUUID());
    expect(declineResponse.status).toBe(403);
    expect(declineResponse.body).toMatchObject({ code: "FORBIDDEN" });

    const cancelResponse = await postAction(strangerPage, request.id, "cancel", randomUUID());
    expect(cancelResponse.status).toBe(403);
    expect(cancelResponse.body).toMatchObject({ code: "FORBIDDEN" });

    await strangerContext.close();
  });

  test("prevents recipient from cancelling a request", async ({ browser, page }) => {
    const sender = makeUser("recip-cancel-sender");
    const recipient = makeUser("recip-cancel-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "22.00",
      note: "Recipient cancel test",
    });

    const cancelResponse = await postAction(recipientPage, request.id, "cancel", randomUUID());
    expect(cancelResponse.status).toBe(403);
    expect(cancelResponse.body).toMatchObject({ code: "FORBIDDEN" });

    await openRequest(recipientPage, request.id);
    await expect(recipientPage.getByRole("button", { name: "Cancel Request" })).toHaveCount(0);
    await expect(recipientPage.getByRole("button", { name: "Pay" })).toBeVisible();

    await recipientContext.close();
  });

  test("rejects cancel on a paid request with 409", async ({ browser, page }) => {
    const sender = makeUser("term-paid-sender");
    const recipient = makeUser("term-paid-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "35.00",
      note: "Terminal paid test",
    });

    await postAction(recipientPage, request.id, "pay", randomUUID());

    const cancelResponse = await postAction(page, request.id, "cancel", randomUUID());
    expect(cancelResponse.status).toBe(409);
    expect(cancelResponse.body).toMatchObject({ code: "CONFLICT" });

    await recipientContext.close();
  });

  test("rejects pay on a declined request with 409", async ({ browser, page }) => {
    const sender = makeUser("term-declined-sender");
    const recipient = makeUser("term-declined-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "28.00",
      note: "Terminal declined test",
    });

    await postAction(recipientPage, request.id, "decline", randomUUID());

    const payResponse = await postAction(recipientPage, request.id, "pay", randomUUID());
    expect(payResponse.status).toBe(409);
    expect(payResponse.body).toMatchObject({ code: "CONFLICT" });

    await recipientContext.close();
  });

  test("rejects pay on a cancelled request with 409", async ({ browser, page }) => {
    const sender = makeUser("term-cancel-sender");
    const recipient = makeUser("term-cancel-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "42.00",
      note: "Terminal cancel test",
    });

    await postAction(page, request.id, "cancel", randomUUID());

    const payResponse = await postAction(recipientPage, request.id, "pay", randomUUID());
    expect(payResponse.status).toBe(409);
    expect(payResponse.body).toMatchObject({ code: "CONFLICT" });

    await recipientContext.close();
  });

  test("handles multiple requests between same users independently", async ({
    browser,
    page,
  }) => {
    const sender = makeUser("multi-sender");
    const recipient = makeUser("multi-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request1 = await createRequest(page, {
      recipient: recipient.email,
      amount: "10.00",
      note: "Multi request 1",
    });

    const request2 = await createRequest(page, {
      recipient: recipient.email,
      amount: "20.00",
      note: "Multi request 2",
    });

    const request3 = await createRequest(page, {
      recipient: recipient.email,
      amount: "30.00",
      note: "Multi request 3",
    });

    await postAction(recipientPage, request1.id, "pay", randomUUID());
    await postAction(recipientPage, request2.id, "decline", randomUUID());

    await openRequest(recipientPage, request1.id);
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Paid/);

    await openRequest(recipientPage, request2.id);
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Declined/);

    await openRequest(recipientPage, request3.id);
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Pending/);

    await recipientContext.close();
  });
});
