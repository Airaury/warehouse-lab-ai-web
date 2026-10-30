import "dotenv/config";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

if (!process.env.DB_ADMIN_USER || !process.env.DB_ADMIN_PASSWORD) {
  console.error(
    "请通过 DB_ADMIN_USER 与 DB_ADMIN_PASSWORD 环境变量提供建表账号。",
  );
  process.exit(1);
}
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_ADMIN_USER,
  password: process.env.DB_ADMIN_PASSWORD,
  charset: "utf8mb4",
  multipleStatements: true,
});
try {
  const schema = await readFile(
    new URL("../schema.sql", import.meta.url),
    "utf8",
  );
  await connection.query(schema);
  const [[column]] = await connection.query(
    "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='ai_warehouse' AND TABLE_NAME='users' AND COLUMN_NAME='deleted_at'",
  );
  if (!column.count) {
    await connection.query(
      "ALTER TABLE ai_warehouse.users ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL",
    );
  }
  const [[roleColumn]] = await connection.query(
    "SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='ai_warehouse' AND TABLE_NAME='users' AND COLUMN_NAME='role'",
  );
  if (!roleColumn?.columnType?.includes("'CHAIRMAN'")) {
    await connection.query(
      "ALTER TABLE ai_warehouse.users MODIFY COLUMN role ENUM('CHAIRMAN','MANAGER','DEPUTY','OPERATOR','VIEWER') NOT NULL",
    );
  }
  const [demoAccounts] = await connection.execute(
    "SELECT id FROM ai_warehouse.users WHERE username='chairman_demo' AND role='DEPUTY' AND deleted_at IS NULL",
  );
  for (const account of demoAccounts) {
    await connection.execute(
      "UPDATE ai_warehouse.users SET role='CHAIRMAN' WHERE id=?",
      [account.id],
    );
    await connection.execute(
      "DELETE FROM ai_warehouse.sessions WHERE user_id=?",
      [account.id],
    );
  }
  const [managers] = await connection.query(
    "SELECT id,username FROM ai_warehouse.users WHERE role='MANAGER' AND deleted_at IS NULL ORDER BY CASE WHEN username='admin' THEN 0 ELSE 1 END,id",
  );
  for (const manager of managers.slice(1)) {
    await connection.execute(
      "UPDATE ai_warehouse.users SET role='DEPUTY' WHERE id=?",
      [manager.id],
    );
    await connection.execute(
      "DELETE FROM ai_warehouse.sessions WHERE user_id=?",
      [manager.id],
    );
  }
  const [[slotColumn]] = await connection.query(
    "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='ai_warehouse' AND TABLE_NAME='users' AND COLUMN_NAME='active_manager_slot'",
  );
  if (!slotColumn.count) {
    await connection.query(
      "ALTER TABLE ai_warehouse.users ADD COLUMN active_manager_slot TINYINT GENERATED ALWAYS AS (CASE WHEN role='MANAGER' AND deleted_at IS NULL THEN 1 ELSE NULL END) STORED, ADD UNIQUE KEY uq_active_manager (active_manager_slot)",
    );
  }
  console.log("Database schema is current.");
} catch (err) {
  console.error(`数据库迁移失败：${err.code || err.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
