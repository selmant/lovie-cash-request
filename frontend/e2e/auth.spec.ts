import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { createRequest, expectProtectedRedirect, login, logout, makeUser, newUserPage, openRequest, signup } from "./helpers";

test.describe("auth scenarios", () => {
  test("redirects unauthenticated users and preserves protected targets", async ({ page }) => {
    const user = makeUser("auth-redirect");

    await page.goto("/new");
    await expectProtectedRedirect(page, "/new");

    await signup(page, user, { navigate: false });
    await expect(page).toHaveURL(/\/new$/);
    await expect(page.getByRole("heading", { name: "New Payment Request" })).toBeVisible();
  });

  test("supports signup, session persistence, logout, login, and auth errors", async ({ page }) => {
    const user = makeUser("auth-user");
    const missingUser = makeUser("missing-user");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Phone (optional)").fill("12345");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText(/invalid phone format/i)).toBeVisible();

    await page.getByLabel("Phone (optional)").fill(user.phone);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

    await page.goto("/new");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "New Payment Request" })).toBeVisible();

    await logout(page);

    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Phone (optional)").fill(user.phone);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText(/account already exists\. please log in\./i)).toBeVisible();

    await page.getByLabel("Email").fill(missingUser.email);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText(/account not found\. please sign up\./i)).toBeVisible();

    await login(page, user.email, { navigate: false });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("rejects action requests without a valid CSRF token", async ({ browser, page }) => {
    const sender = makeUser("csrf-sender");
    const recipient = makeUser("csrf-recipient");

    const { context: recipientContext, page: recipientPage } = await newUserPage(browser);
    await signup(page, sender);
    await signup(recipientPage, recipient);

    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "15.00",
      note: "CSRF test",
    });

    const response = await recipientPage.evaluate(
      async ({ requestId, idempotencyKey }) => {
        const res = await fetch(`/api/requests/${requestId}/pay`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
        });
        const text = await res.text();
        try {
          return { status: res.status, body: JSON.parse(text) };
        } catch {
          return { status: res.status, body: text };
        }
      },
      { requestId: request.id, idempotencyKey: randomUUID() },
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: "FORBIDDEN" });

    await openRequest(recipientPage, request.id);
    await expect(recipientPage.locator('[aria-label="Request status"]')).toHaveText(/Pending/);

    await recipientContext.close();
  });
});
