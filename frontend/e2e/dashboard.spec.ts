import { expect, test } from "@playwright/test";

import {
  createRequest,
  expectNoHorizontalOverflow,
  makeUser,
  newUserPage,
  setStatusFilter,
  signup,
} from "./helpers";

test.describe("dashboard scenarios", () => {
  test("shows sorted request lists and supports filter/search combinations", async ({
    browser,
    page,
  }) => {
    const mainUser = makeUser("dashboard-main");
    const phoneRecipient = makeUser("dashboard-phone");
    const emailRecipient = makeUser("dashboard-email");
    const incomingSender = makeUser("dashboard-incoming");

    const { context: phoneContext, page: phonePage } = await newUserPage(browser);
    const { context: emailContext, page: emailPage } = await newUserPage(browser);
    const { context: incomingContext, page: incomingPage } = await newUserPage(browser);

    await signup(page, mainUser);
    await signup(phonePage, phoneRecipient);
    await signup(emailPage, emailRecipient);
    await signup(incomingPage, incomingSender);

    await createRequest(page, {
      recipient: phoneRecipient.phone,
      amount: "12.00",
      note: "Older pending request",
    });

    const cancelledRequest = await createRequest(page, {
      recipient: emailRecipient.email,
      amount: "18.50",
      note: "Newest cancelled request",
    });
    await page.getByRole("button", { name: "Cancel Request" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel Request" }).click();

    await incomingPage.goto("/new");
    await incomingPage.getByLabel("Recipient (email or phone)").fill(mainUser.phone);
    await incomingPage.getByLabel("Amount").fill("65.00");
    await incomingPage.getByLabel("Note (optional)").fill("Incoming dashboard request");
    await incomingPage.getByRole("button", { name: "Send Request" }).click();

    await page.goto("/");
    await expect(page.getByRole("tab", { name: "Outgoing" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Incoming" })).toBeVisible();

    const outgoingCards = page.getByRole("tabpanel").locator("a");
    await expect(outgoingCards.nth(0)).toContainText("Newest cancelled request");
    await expect(outgoingCards.nth(1)).toContainText("Older pending request");

    await page.getByPlaceholder("Search by email or phone...").fill(phoneRecipient.phone.slice(-4));
    await expect(page.getByText("Older pending request")).toBeVisible();
    await expect(page.getByText("Newest cancelled request")).toHaveCount(0);

    await page.getByPlaceholder("Search by email or phone...").fill("");
    await setStatusFilter(page, "Pending");
    await expect(page.getByText("Older pending request")).toBeVisible();
    await expect(page.getByText("Newest cancelled request")).toHaveCount(0);

    await setStatusFilter(page, "Cancelled");
    await page.getByPlaceholder("Search by email or phone...").fill(emailRecipient.email.slice(0, 8));
    await expect(page.getByText("Newest cancelled request")).toBeVisible();
    await expect(page.getByText("Older pending request")).toHaveCount(0);

    await page.getByRole("tab", { name: "Incoming" }).click();
    await page.getByPlaceholder("Search by email or phone...").fill(incomingSender.phone.slice(-4));
    await expect(page.getByText("Incoming dashboard request")).toBeVisible();

    await page.getByPlaceholder("Search by email or phone...").fill("no-matches-here");
    await expect(page.getByText("No requests match your filters")).toBeVisible();

    await page.goto(`/requests/${cancelledRequest.id}`);
    await expect(page.locator('[aria-label="Request status"]')).toHaveText(/Cancelled/);

    await phoneContext.close();
    await emailContext.close();
    await incomingContext.close();
  });

  test("shows empty state for a fresh user with no requests", async ({ page }) => {
    const user = makeUser("empty-dash-user");
    await signup(page, user);

    await page.goto("/");
    await expect(page.getByRole("tab", { name: "Outgoing" })).toBeVisible();
    await expect(page.getByText(/no requests/i)).toBeVisible();
  });

  test("remains usable on mobile without horizontal overflow", async ({ page }) => {
    const user = makeUser("mobile-user");

    await page.setViewportSize({ width: 375, height: 812 });
    await signup(page, user);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
