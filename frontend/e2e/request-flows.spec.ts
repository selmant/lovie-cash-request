import { expect, type Page, test } from "@playwright/test";

type TestUser = {
  email: string;
  phone: string;
};

test.describe("cash request flows", () => {
  test("preserves share-link redirects and lets the recipient pay a request", async ({
    browser,
    page,
  }) => {
    const sender = makeUser("sender");
    const recipient = makeUser("recipient");
    const note = "Lunch split";

    await signup(page, sender);
    const request = await createRequest(page, {
      recipient: recipient.email,
      amount: "25.00",
      note,
    });

    await page.goto("/");
    await expect(page.getByText(note)).toBeVisible();
    await expect(page.getByText(/^Pending$/)).toBeVisible();

    const recipientContext = await browser.newContext();
    const recipientPage = await recipientContext.newPage();
    await recipientPage.goto(request.shareUrl);
    await expect(recipientPage).toHaveURL(/\/login\?redirect=/);

    await signup(recipientPage, recipient, { navigate: false });
    await expect(recipientPage).toHaveURL(/\/requests\/.+$/);
    const requestDetail = recipientPage.getByRole("main");
    await expect(requestDetail.getByRole("button", { name: "Pay" })).toBeVisible();
    await expect(requestDetail.getByRole("button", { name: "Decline" })).toBeVisible();

    await requestDetail.getByRole("button", { name: "Pay" }).click();
    const payDialog = recipientPage.getByRole("alertdialog");
    await expect(payDialog).toBeVisible();
    await payDialog.getByRole("button", { name: "Pay" }).click();
    await expect(recipientPage.getByText(/^Paid$/)).toBeVisible();
    await expect(requestDetail.getByRole("button", { name: "Pay" })).toHaveCount(0);

    await recipientPage.goto("/");
    await recipientPage.getByRole("tab", { name: "Incoming" }).click();
    await recipientPage.getByPlaceholder("Search by email or phone...").fill(sender.email);
    await expect(recipientPage.getByText(note)).toBeVisible();
    await expect(recipientPage.getByText(/^Paid$/)).toBeVisible();

    await page.goto("/");
    await page.getByPlaceholder("Search by email or phone...").fill(recipient.email);
    await expect(page.getByText(note)).toBeVisible();
    await expect(page.getByText(/^Paid$/)).toBeVisible();

    await recipientContext.close();
  });

  test("filters and searches outgoing requests after a sender cancels one", async ({ page }) => {
    const sender = makeUser("dashboard");
    const pendingRecipient = makeUser("pending");
    const cancelledRecipient = makeUser("cancelled");

    const pendingNote = "Groceries";
    const cancelledNote = "Concert tickets";

    await signup(page, sender);

    await createRequest(page, {
      recipient: pendingRecipient.email,
      amount: "12.00",
      note: pendingNote,
    });

    await createRequest(page, {
      recipient: cancelledRecipient.email,
      amount: "18.50",
      note: cancelledNote,
    });

    await page.getByRole("button", { name: "Cancel Request" }).click();
    const cancelDialog = page.getByRole("alertdialog");
    await expect(cancelDialog).toBeVisible();
    await cancelDialog.getByRole("button", { name: "Cancel Request" }).click();
    await expect(page.getByText(/^Cancelled$/)).toBeVisible();

    await page.goto("/");
    const searchInput = page.getByPlaceholder("Search by email or phone...");
    await searchInput.fill(pendingRecipient.email);
    await expect(page.getByText(pendingNote)).toBeVisible();
    await expect(page.getByText(cancelledNote)).toHaveCount(0);

    await searchInput.fill("");
    await setStatusFilter(page, "Cancelled");
    await expect(page.getByText(cancelledNote)).toBeVisible();
    await expect(page.getByText(pendingNote)).toHaveCount(0);
  });
});

async function signup(
  page: Page,
  user: TestUser,
  options: { navigate?: boolean } = {},
): Promise<void> {
  if (options.navigate !== false) {
    await page.goto("/login");
  }

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Phone (optional)").fill(user.phone);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function createRequest(
  page: Page,
  input: { recipient: string; amount: string; note: string },
): Promise<{ shareUrl: string }> {
  await page.goto("/new");
  await expect(page.getByRole("heading", { name: "New Payment Request" })).toBeVisible();

  await page.getByLabel("Recipient (email or phone)").fill(input.recipient);
  await page.getByLabel("Amount").fill(input.amount);
  await page.getByLabel("Note (optional)").fill(input.note);
  await page.getByRole("button", { name: "Send Request" }).click();

  await expect(page).toHaveURL(/\/requests\/.+$/);
  await expect(page.getByText(/^Pending$/)).toBeVisible();
  await expect(page.getByText(input.note)).toBeVisible();

  return {
    shareUrl: await page.getByLabel("Shareable Link").inputValue(),
  };
}

async function setStatusFilter(page: Page, status: string): Promise<void> {
  await page.getByRole("combobox", { name: "Status filter" }).click();
  await page.getByRole("option", { name: status }).click();
}

function makeUser(label: string): TestUser {
  const id = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const digits = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`
    .slice(-10)
    .padStart(10, "7");

  return {
    email: `${id}@example.com`,
    phone: `+1415${digits}`,
  };
}
