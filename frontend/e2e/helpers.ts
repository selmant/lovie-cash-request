import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export type TestUser = {
  email: string;
  phone: string;
};

export type CreatedRequest = {
  id: string;
  shareUrl: string;
};

type AuthOptions = {
  navigate?: boolean;
};

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(e2eDir, "..", "..");

export async function newUserPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

export async function signup(
  page: Page,
  user: TestUser,
  options: AuthOptions = {},
): Promise<void> {
  if (options.navigate !== false) {
    await page.goto("/login");
  }

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Phone (optional)").fill(user.phone);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function login(
  page: Page,
  email: string,
  options: AuthOptions = {},
): Promise<void> {
  if (options.navigate !== false) {
    await page.goto("/login");
  }

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function createRequest(
  page: Page,
  input: { recipient: string; amount: string; note?: string },
): Promise<CreatedRequest> {
  await page.goto("/new");
  await expect(page.getByRole("heading", { name: "New Payment Request" })).toBeVisible();

  await page.getByLabel("Recipient (email or phone)").fill(input.recipient);
  await page.getByLabel("Amount").fill(input.amount);
  await page.getByLabel("Note (optional)").fill(input.note ?? "");
  await page.getByRole("button", { name: "Send Request" }).click();

  await expect(page).toHaveURL(/\/requests\/.+$/);
  await expect(page.locator('[aria-label="Request status"]')).toHaveText(/Pending/);

  const requestId = requestIdFromUrl(page.url());
  return {
    id: requestId,
    shareUrl: await page.getByLabel("Shareable Link").inputValue(),
  };
}

export async function openRequest(page: Page, requestId: string): Promise<void> {
  await page.goto(`/requests/${requestId}`);
  await expect(page.getByRole("heading", { name: "Payment Request" })).toBeVisible();
}

export async function setStatusFilter(page: Page, status: string): Promise<void> {
  await page.getByRole("combobox", { name: "Status filter" }).click();
  await page.getByRole("option", { name: status }).click();
}

export async function postAction(
  page: Page,
  requestId: string,
  action: "pay" | "decline" | "cancel",
  idempotencyKey: string,
): Promise<{ status: number; body: unknown }> {
  return page.evaluate(
    async ({ requestId: localRequestId, action: localAction, idempotencyKey: localIdempotencyKey }) => {
      const match = document.cookie.match(/csrf_token=([^;]+)/);
      const csrfToken = match?.[1] ? decodeURIComponent(match[1]) : "";

      const response = await fetch(`/api/requests/${localRequestId}/${localAction}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": localIdempotencyKey,
          "X-CSRF-Token": csrfToken,
        },
      });

      const text = await response.text();
      try {
        return { status: response.status, body: JSON.parse(text) };
      } catch {
        return { status: response.status, body: text };
      }
    },
    { requestId: requestId, action: action, idempotencyKey: idempotencyKey },
  );
}

export function updateRequestTimestamps(
  requestId: string,
  input: { createdAt?: string; expiresAt?: string; status?: string },
): void {
  const sets: string[] = [];

  if (input.createdAt) {
    sets.push(`created_at = ${input.createdAt}`);
  }
  if (input.expiresAt) {
    sets.push(`expires_at = ${input.expiresAt}`);
  }
  if (input.status) {
    sets.push(`status = '${input.status}'`);
  }

  if (sets.length === 0) {
    return;
  }

  runSql(`UPDATE payment_requests SET ${sets.join(", ")} WHERE id = '${requestId}'::uuid;`);
}

export function requestIdFromUrl(url: string): string {
  const match = url.match(/\/requests\/([^/?#]+)/);
  if (!match) {
    throw new Error(`Could not extract request id from ${url}`);
  }

  return match[1];
}

export async function expectProtectedRedirect(page: Page, target: string): Promise<void> {
  await expect(page).toHaveURL(/\/login\?redirect=/);

  const url = new URL(page.url());
  expect(url.pathname).toBe("/login");
  expect(url.searchParams.get("redirect")).toBe(target);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const fitsViewport = await page.evaluate(() => {
    const width = window.innerWidth;
    return document.documentElement.scrollWidth <= width && document.body.scrollWidth <= width;
  });

  expect(fitsViewport).toBe(true);
}

export function makeUser(label: string): TestUser {
  const id = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const digits = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`
    .slice(-10)
    .padStart(10, "7");

  return {
    email: `${id}@example.com`,
    phone: `+1415${digits}`,
  };
}

function runSql(sql: string): void {
  execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "postgres",
      "-d",
      "cash_request",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { cwd: repoRoot, stdio: "pipe" },
  );
}
