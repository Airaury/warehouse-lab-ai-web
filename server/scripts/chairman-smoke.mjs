import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { pool } from "../src/db.js";

const base = `http://127.0.0.1:${process.env.PORT || 3001}`;
const password = process.env.DEMO_CHAIRMAN_PASSWORD;
assert(password && !password.startsWith("replace-"), "请先配置演示账号密码");

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

let chairmanCookie = "";
let managerHash = "";
let disposableManagerId = null;
try {
  const login = await call("/api/auth/login", "POST", {
    username: "chairman_demo",
    password,
  });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  assert.equal(login.data.user.role, "CHAIRMAN");
  chairmanCookie = login.cookie;
  assert(chairmanCookie);

  const users = await call("/api/users", "GET", undefined, chairmanCookie);
  assert.equal(users.status, 200);
  const chairman = users.data.users.find((user) => user.username === "chairman_demo");
  assert.equal(chairman?.role, "CHAIRMAN");
  assert.equal(
    (await call(`/api/users/${chairman.id}`, "DELETE", undefined, chairmanCookie)).status,
    400,
  );
  assert.equal(
    (await call("/api/users/999999999", "DELETE", undefined, chairmanCookie)).status,
    404,
  );

  const manager = users.data.users.find((user) => user.role === "MANAGER");
  if (manager) {
    const managerToken = randomBytes(32).toString("hex");
    managerHash = createHash("sha256").update(managerToken).digest("hex");
    await pool.execute(
      "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
      [managerHash, manager.id],
    );
    const managerCookie = `warehouse_session=${managerToken}`;
    assert.equal(
      (await call(`/api/users/${chairman.id}`, "DELETE", undefined, managerCookie)).status,
      403,
    );
    assert.equal(
      (await call(`/api/users/${chairman.id}/reset-password`, "POST", { newPassword: randomBytes(20).toString("hex") }, managerCookie)).status,
      403,
    );
    const duplicate = await call("/api/users", "POST", {
      username: `check_manager_${Date.now().toString(36)}`,
      displayName: "临时主管",
      role: "MANAGER",
      password: randomBytes(20).toString("hex"),
    }, chairmanCookie);
    assert.equal(duplicate.status, 409);
  } else {
    const name = `check_manager_${Date.now().toString(36)}`;
    const created = await call("/api/users", "POST", {
      username: name,
      displayName: "临时主管",
      role: "MANAGER",
      password: randomBytes(20).toString("hex"),
    }, chairmanCookie);
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const [[row]] = await pool.execute("SELECT id FROM users WHERE username=?", [name]);
    disposableManagerId = row.id;
    assert.equal(
      (await call(`/api/users/${row.id}`, "DELETE", undefined, chairmanCookie)).status,
      200,
    );
  }
  console.log("通过：董事长登录、账号管理、主管账号操作边界与会话保护");
} finally {
  if (disposableManagerId) {
    await pool.execute(
      "UPDATE users SET username=CONCAT('deleted_',id),deleted_at=NOW() WHERE id=? AND deleted_at IS NULL",
      [disposableManagerId],
    );
    await pool.execute("DELETE FROM sessions WHERE user_id=?", [disposableManagerId]);
  }
  if (managerHash) await pool.execute("DELETE FROM sessions WHERE token_hash=?", [managerHash]);
  if (chairmanCookie) {
    const token = chairmanCookie.split("=")[1];
    const hash = createHash("sha256").update(token).digest("hex");
    await pool.execute("DELETE FROM sessions WHERE token_hash=?", [hash]);
  }
  await pool.end();
}
