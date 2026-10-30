import "dotenv/config";
import mysql from "mysql2/promise";
import { hashPassword } from "../src/auth.js";

const username = String(process.env.RECOVERY_USERNAME || "").trim();
const newPassword = String(process.env.RECOVERY_NEW_PASSWORD || "");
if (
  !process.env.DB_ADMIN_USER ||
  !process.env.DB_ADMIN_PASSWORD ||
  !username ||
  newPassword.length < 12 ||
  newPassword.length > 128
) {
  console.error(
    "请在私有终端环境变量中提供 DB_ADMIN_USER、DB_ADMIN_PASSWORD、RECOVERY_USERNAME 和 12—128 位 RECOVERY_NEW_PASSWORD。",
  );
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_ADMIN_USER,
  password: process.env.DB_ADMIN_PASSWORD,
  database: process.env.DB_NAME || "ai_warehouse",
});
try {
  await connection.beginTransaction();
  const [[account]] = await connection.execute(
    "SELECT id FROM users WHERE username=? AND role IN ('CHAIRMAN','MANAGER') AND deleted_at IS NULL FOR UPDATE",
    [username],
  );
  if (!account) throw new Error("未找到有效的董事长或主管账号");
  await connection.execute("UPDATE users SET password_hash=? WHERE id=?", [
    await hashPassword(newPassword),
    account.id,
  ]);
  await connection.execute("DELETE FROM sessions WHERE user_id=?", [
    account.id,
  ]);
  await connection.commit();
  console.log("账号密码已恢复，原有登录会话已失效。");
} catch (err) {
  await connection.rollback();
  console.error(`恢复失败：${err.code || err.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
