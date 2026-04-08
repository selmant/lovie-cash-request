import { expect, test } from "@playwright/test";

import {
  createRequest,
  makeUser,
  newUserPage,
  postAction,
  setStatusFilter,
  signup,
  updateRequestTimestamps,
} from "./helpers";

test.describe("expiration scenarios", () => {
  test("shows countdowns in days and then hours/minutes for pending requests", async ({ browser, page }) => {
    const sender = makeUser("expiry-sender");
    const recipient = makeUser("expiry-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "24.00",
      note: "Countdown request",
    });

    updateRequestTimestamps(request.id, {
      createdAt: "now() - interval '5 days'",
      expiresAt: "now() + interval '49 hours'",
      status: "pending",
    });
    await page.reload();
    await expect(page.getByText(/\d+d \d+h remaining/)).toBeVisible();

    updateRequestTimestamps(request.id, {
      expiresAt: "now() + interval '5 hours 32 minutes'",
      status: "pending",
    });
    await page.reload();
    await expect(page.getByText(/\d+h \d+m remaining/)).toBeVisible();

    await recipientContext.close();
  });

  test("derives expired status, blocks expired actions, and rejects cancel after expiry without conflict", async ({
    browser,
    page,
  }) => {
    const sender = makeUser("expired-sender");
    const recipient = makeUser("expired-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "57.00",
      note: "Expired request",
    });

    updateRequestTimestamps(request.id, {
      createdAt: "now() - interval '8 days'",
      expiresAt: "now() - interval '1 hour'",
      status: "pending",
    });

    await recipientPage.goto(`/requests/${request.id}`);
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Expired/);
    await expect(recipientPage.getByText(/this request has expired/i)).toBeVisible();
    await expect(recipientPage.getByRole("button", { name: "Pay" })).toHaveCount(0);
    await expect(recipientPage.getByRole("button", { name: "Decline" })).toHaveCount(0);
    await expect(recipientPage.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/).first()).toBeVisible();

    const payResponse = await postAction(recipientPage, request.id, "pay", "expired-pay-key");
    expect(payResponse.status).toBe(410);
    expect(payResponse.body).toMatchObject({ code: "EXPIRED" });

    const cancelResponse = await postAction(page, request.id, "cancel", "expired-cancel-key");
    expect(cancelResponse.status).toBe(410);
    expect(cancelResponse.body).toMatchObject({ code: "EXPIRED" });

    await page.goto("/");
    await setStatusFilter(page, "Expired");
    await expect(page.getByText("Expired request")).toBeVisible();

    await recipientContext.close();
  });
});
