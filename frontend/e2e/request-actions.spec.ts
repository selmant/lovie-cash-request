import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import {
  createRequest,
  makeUser,
  newUserPage,
  openRequest,
  postAction,
  setStatusFilter,
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
});
