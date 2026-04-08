import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { createRequest, makeUser, newUserPage, postAction, signup } from "./helpers";

test.describe("request creation scenarios", () => {
  test("creates requests with and without notes and resolves pending requests after recipient signup", async ({
    browser,
    page,
  }) => {
    const sender = makeUser("sender-create");
    const recipient = makeUser("recipient-create");
    const note = "Lunch";

    await signup(page, sender);

    const firstRequest = await createRequest(page, {
      recipient: recipient.email,
      amount: "25.00",
      note,
    });
    await expect(page.getByText(note)).toBeVisible();
    await expect(page.getByLabel("Shareable Link")).toHaveValue(/\/r\//);

    const secondRequest = await createRequest(page, {
      recipient: recipient.phone,
      amount: "40",
    });
    await expect(page.getByText("Note")).toHaveCount(0);

    await page.goto("/");
    await page.getByPlaceholder("Search by email or phone...").fill(recipient.email);
    await expect(page.getByText(note)).toBeVisible();

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(recipientPage, recipient);
    await recipientPage.getByRole("tab", { name: "Incoming" }).click();
    await recipientPage.getByPlaceholder("Search by email or phone...").fill(sender.email);
    await expect(recipientPage.getByText(note)).toBeVisible();

    await recipientPage.getByPlaceholder("Search by email or phone...").fill(sender.phone.slice(-4));
    await expect(recipientPage.getByText(note)).toBeVisible();

    await recipientPage.goto(`/requests/${secondRequest.id}`);
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Pending/);

    await recipientContext.close();
    expect(firstRequest.id).not.toBe(secondRequest.id);
  });

  test("validates amount, recipient format, and self-request edge cases", async ({ page }) => {
    const sender = makeUser("sender-validation");

    await signup(page, sender);
    await page.goto("/new");

    await submitInvalidRequest(page, {
      recipient: "friend@example.com",
      amount: "0",
      expectedText: /amount must be between/i,
    });

    await submitInvalidRequest(page, {
      recipient: "friend@example.com",
      amount: "-1.00",
      expectedText: /amount must be between/i,
    });

    await submitInvalidRequest(page, {
      recipient: "friend@example.com",
      amount: "10000.01",
      expectedText: /amount must be between/i,
    });

    await submitInvalidRequest(page, {
      recipient: "friend@example.com",
      amount: "10.999",
      expectedText: /at most 2 decimal places/i,
    });

    await submitInvalidRequest(page, {
      recipient: "notanemail",
      amount: "25.00",
      expectedText: /invalid email format/i,
    });

    await submitInvalidRequest(page, {
      recipient: "+12345",
      amount: "25.00",
      expectedText: /invalid phone format/i,
    });

    await submitInvalidRequest(page, {
      recipient: sender.email,
      amount: "25.00",
      expectedText: /cannot request money from yourself/i,
    });

    await submitInvalidRequest(page, {
      recipient: sender.phone,
      amount: "25.00",
      expectedText: /cannot request money from yourself/i,
    });
  });

  test("redirects unauthenticated recipients through share links and blocks unrelated viewers", async ({
    browser,
    page,
  }) => {
    const sender = makeUser("share-sender");
    const recipient = makeUser("share-recipient");
    const stranger = makeUser("share-stranger");

    await signup(page, sender);
    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "25.00",
      note: "Shared dinner",
    });

    const shareToken = new URL(request.shareUrl).pathname;

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await recipientPage.goto(shareToken);
    await expect(recipientPage).toHaveURL(/\/login\?redirect=/);
    await signup(recipientPage, recipient, { navigate: false });
    await expect(recipientPage).toHaveURL(/\/requests\/.+$/);
    await expect(recipientPage.getByRole("button", { name: "Pay" })).toBeVisible();
    await expect(recipientPage.getByRole("button", { name: "Decline" })).toBeVisible();

    const { context: strangerContext, page: strangerPage } = await newUserPage(browser);
    await signup(strangerPage, stranger);
    await strangerPage.goto(shareToken);
    await expect(strangerPage.getByText(/not authorized to view this request/i)).toBeVisible();

    await recipientContext.close();
    await strangerContext.close();
  });

  test("shows 'Request not found' for non-existent and invalid request IDs", async ({ page }) => {
    const user = makeUser("notfound-user");
    await signup(page, user);

    await page.goto(`/requests/${randomUUID()}`);
    await expect(page.getByText("Request not found")).toBeVisible();

    await page.goto("/requests/not-a-valid-uuid");
    await expect(page.getByText("Request not found")).toBeVisible();
  });

  test("returns 404 when acting on a non-existent request via API", async ({ page }) => {
    const user = makeUser("notfound-action-user");
    await signup(page, user);

    const response = await postAction(page, randomUUID(), "pay", randomUUID());
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: "NOT_FOUND" });
  });

  test("handles share link with non-existent token", async ({ page }) => {
    const user = makeUser("bad-share-user");
    await signup(page, user);

    await page.goto("/r/nonexistent-token-abc123");
    await expect(page.getByText(/not found/i).or(page.getByText(/not authorized/i))).toBeVisible();
  });
});

async function submitInvalidRequest(
  page: import("@playwright/test").Page,
  input: { recipient: string; amount: string; expectedText: RegExp },
) {
  await page.goto("/new");
  await page.getByLabel("Recipient (email or phone)").fill(input.recipient);
  await page.getByLabel("Amount").fill(input.amount);
  await page.getByRole("button", { name: "Send Request" }).click();
  await expect(page.getByText(input.expectedText)).toBeVisible();
  await expect(page).toHaveURL(/\/new$/);
}
