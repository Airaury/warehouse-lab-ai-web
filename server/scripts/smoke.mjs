import "dotenv/config";
import assert from "node:assert/strict";

const base = `http://127.0.0.1:${process.env.PORT || 3001}`;
let cookie = "";
async function call(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

const noAuth = await call("/api/dashboard");
assert.equal(noAuth.response.status, 401);
const login = await call("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({
    username: "admin",
    password: process.env.BOOTSTRAP_MANAGER_PASSWORD || process.env.ADMIN_TOKEN,
  }),
});
assert.equal(login.response.status, 200, JSON.stringify(login.data));
assert.equal(login.data.user.role, "MANAGER");
cookie = login.response.headers.get("set-cookie")?.split(";")[0];
assert(cookie);

const before = await call("/api/dashboard");
assert.equal(before.response.status, 200);
const item =
  before.data.items.find((row) => row.quantity <= row.minQuantity) ||
  before.data.items[0];
const initial = item.quantity;
const request = await call("/api/replenishments", {
  method: "POST",
  body: JSON.stringify({ itemId: item.id, quantity: 1, reason: "联动验收" }),
});
assert.equal(request.response.status, 201, JSON.stringify(request.data));
const pending = (await call("/api/dashboard")).data.replenishments.find(
  (row) => row.itemId === item.id && row.status === "PENDING",
);
assert(pending);
const approval = await call(`/api/replenishments/${pending.id}/review`, {
  method: "POST",
  body: JSON.stringify({ decision: "APPROVED" }),
});
assert.equal(approval.response.status, 200);
const receive = await call(`/api/replenishments/${pending.id}/receive`, {
  method: "POST",
});
assert.equal(receive.response.status, 200);
const afterReceive = (await call("/api/dashboard")).data;
assert.equal(
  afterReceive.items.find((row) => row.id === item.id).quantity,
  initial + 1,
);
const restore = await call("/api/movements", {
  method: "POST",
  body: JSON.stringify({
    itemId: item.id,
    quantity: 1,
    direction: "OUT",
    note: "联动验收库存还原",
  }),
});
assert.equal(restore.response.status, 201);
const after = (await call("/api/dashboard")).data;
assert.equal(after.items.find((row) => row.id === item.id).quantity, initial);
assert(
  after.replenishments.find((row) => row.id === pending.id)?.status ===
    "RECEIVED",
);
const analytics = await call("/api/analytics");
assert.equal(analytics.response.status, 200);
assert.equal(analytics.data.trend.length, 14);
const notices = await call("/api/notifications");
assert.equal(notices.response.status, 200);
assert(notices.data.notifications.length > 0);
if (process.env.RUN_AI === "1") {
  const ai = await call("/api/ai/advice", {
    method: "POST",
    body: JSON.stringify({
      question: "请指出当前低于安全阈值的物资，列出 SKU 与数量。",
    }),
  });
  assert.equal(ai.response.status, 200, JSON.stringify(ai.data));
  assert(ai.data.answer.length > 20);
  console.log("通过：DeepSeek 基于实时库存返回建议");
}
const logout = await call("/api/auth/logout", { method: "POST" });
assert.equal(logout.response.status, 200);
assert.equal((await call("/api/dashboard")).response.status, 401);
console.log(
  "通过：登录保护、补货申请→审批→收货→库存更新、统计、消息、退出；库存已还原",
);
