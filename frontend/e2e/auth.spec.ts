import { expect, test } from "@playwright/test";

import { expectProtectedRedirect, login, logout, makeUser, signup } from "./helpers";

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
    await expect(page.getByText(user.email)).toBeVisible();

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
    await expect(page.getByText(user.email)).toBeVisible();
  });
});
