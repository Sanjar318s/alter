import { test, expect } from "@playwright/test";

test("registration → заказ → платёж → чат", async ({ page, request }) => {
  const api = process.env.PLAYWRIGHT_API || "http://127.0.0.1:4000";
  const stamp = Date.now();
  const username = `e2e_${stamp}`;
  const email = `${username}@alter.test`;
  const password = "alter12345";

  const start = await request.post(`${api}/api/auth/register`, {
    data: { username, password, method: "email", email, roleFlags: "maker" },
  });
  expect(start.ok()).toBeTruthy();
  const pending = await start.json();

  const verify = await request.post(`${api}/api/auth/verify`, {
    data: { pendingId: pending.pendingId, code: pending.devCode || "000000" },
  });
  expect(verify.ok()).toBeTruthy();
  const session = await verify.json();
  const token = session.token as string;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const users = await request.get(`${api}/api/users/search?q=${username.slice(0, 4)}`, { headers });
  const found = await users.json();
  const clientId = found.users?.find((u: { username?: string }) => u.username === username)?.id;
  expect(clientId).toBeTruthy();

  const orderRes = await request.post(`${api}/api/orders`, {
    headers,
    data: { clientId, title: "E2E заказ", budget: 100000, deadline: new Date().toISOString() },
  });
  expect(orderRes.ok()).toBeTruthy();
  const order = await orderRes.json();
  const orderId = order.order?.id;
  expect(orderId).toBeTruthy();

  const pay = await request.post(`${api}/api/orders/${orderId}/payments`, {
    headers,
    data: { amount: 50000, kind: "deposit" },
  });
  expect(pay.ok()).toBeTruthy();

  const chat = await request.post(`${api}/api/messages/conversations`, {
    headers,
    data: { participantId: clientId },
  });
  expect(chat.ok()).toBeTruthy();
  const conv = await chat.json();

  const msg = await request.post(`${api}/api/messages/${conv.conversationId}`, {
    headers,
    data: { text: "E2E привет", type: "text" },
  });
  expect(msg.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByPlaceholder("you@mail.com или +998…").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/explore/);
});
