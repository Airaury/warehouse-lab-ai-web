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
  console.log("Database schema is current.");
} catch (err) {
  console.error(`数据库迁移失败：${err.code || err.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
