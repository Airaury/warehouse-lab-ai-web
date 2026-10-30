import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { pool } from "../src/db.js";
import { hashPassword } from "../src/auth.js";

const base = `http://127.0.0.1:${process.env.PORT || 3001}`;
const username = `smoke_${Date.now().toString(36)}`;
const firstPassword = randomBytes(20).toString("hex");
const changedPassword = randomBytes(20).toString("hex");
const resetPassword = randomBytes(20).toString("hex");
const managerToken = randomBytes(32).toString("hex");
const managerHash = createHash("sha256").update(managerToken).digest("hex");
const managerCookie = `warehouse_session=${managerToken}`;
let createdId = null;

async function call(path, method = "GET", body, cookie = "") {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
    cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
  };
}

try {
  const [[manager]] = await pool.query(
    "SELECT id FROM users WHERE role='MANAGER' AND deleted_at IS NULL ORDER BY id LIMIT 1",
  );
  assert(manager, "需要一个现有主管账号");
  await pool.execute(
    "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
    [managerHash, manager.id],
  );
  assert.equal(
    (await call(`/api/users/${manager.id}`, "DELETE", undefined, managerCookie))
      .status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/users",
        "POST",
        {
          username: `${username}_manager`,
          displayName: "额外主管",
          role: "MANAGER",
          password: firstPassword,
        },
        managerCookie,
      )
    ).status,
    400,
  );
  const created = await call(
    "/api/users",
    "POST",
    {
      username,
      displayName: "本机验收账号",
      role: "DEPUTY",
      password: firstPassword,
    },
    managerCookie,
  );
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const [[row]] = await pool.execute("SELECT id FROM users WHERE username=?", [
    username,
  ]);
  createdId = row.id;

  const login = await call("/api/auth/login", "POST", {
    username,
    password: firstPassword,
  });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  assert.equal(login.data.user.role, "DEPUTY");
  const userCookie = login.cookie;
  assert(userCookie);
  assert.equal(
    (await call("/api/users", "GET", undefined, userCookie)).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/approvals/999999",
        "POST",
        { decision: "REJECTED" },
        userCookie,
      )
    ).status,
    409,
  );
  const before = await call("/api/notifications", "GET", undefined, userCookie);
  assert.equal(before.status, 200);
  const allRead = await call(
    "/api/notifications/read-all",
    "POST",
    undefined,
    userCookie,
  );
  assert.equal(allRead.status, 200, JSON.stringify(allRead.data));
  assert.equal(
    (await call("/api/notifications", "GET", undefined, userCookie)).data
      .unread,
    0,
  );

  assert.equal(
    (
      await call(
        "/api/auth/change-password",
        "POST",
        {
          currentPassword: "wrong",
          newPassword: changedPassword,
        },
        userCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/auth/change-password",
        "POST",
        {
          currentPassword: firstPassword,
          newPassword: changedPassword,
        },
        userCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/api/auth/login", "POST", {
        username,
        password: firstPassword,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("/api/auth/login", "POST", {
        username,
        password: changedPassword,
      })
    ).status,
    200,
  );

  const reset = await call(
    `/api/users/${createdId}/reset-password`,
    "POST",
    {
      newPassword: resetPassword,
    },
    managerCookie,
  );
  assert.equal(reset.status, 200, JSON.stringify(reset.data));
  assert.equal(
    (await call("/api/auth/me", "GET", undefined, userCookie)).status,
    401,
  );
  assert.equal(
    (
      await call("/api/auth/login", "POST", {
        username,
        password: resetPassword,
      })
    ).status,
    200,
  );

  const deleted = await call(
    `/api/users/${createdId}`,
    "DELETE",
    undefined,
    managerCookie,
  );
  assert.equal(deleted.status, 200, JSON.stringify(deleted.data));
  assert.equal(
    (
      await call("/api/auth/login", "POST", {
        username,
        password: resetPassword,
      })
    ).status,
    401,
  );
  const users = await call("/api/users", "GET", undefined, managerCookie);
  assert(!users.data.users.some((user) => user.id === createdId));
  console.log(
    "通过：主管与副主管权限边界、主管删号/重置、本人改密、会话撤销、消息一键已读",
  );
} finally {
  if (createdId) {
    await pool.execute(
      "UPDATE users SET username=CONCAT('deleted_',id),password_hash=?,deleted_at=NOW() WHERE id=? AND deleted_at IS NULL",
      [await hashPassword(randomBytes(20).toString("hex")), createdId],
    );
    await pool.execute("DELETE FROM sessions WHERE user_id=?", [createdId]);
  }
  await pool.execute("DELETE FROM sessions WHERE token_hash=?", [managerHash]);
  await pool.end();
}
