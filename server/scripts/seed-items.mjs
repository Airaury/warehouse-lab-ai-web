import "dotenv/config";
import { readFile } from "node:fs/promises";
import { pool } from "../src/db.js";

const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
const insert = schema.match(/INSERT INTO items \(sku,name,category,zone,quantity,min_quantity,unit\) VALUES[\s\S]*?ON DUPLICATE KEY UPDATE id=id;/);
if (!insert) throw new Error("schema.sql 中未找到示例物资数据");
try {
  await pool.query(insert[0]);
  const [[{ count }]] = await pool.query("SELECT COUNT(*) AS count FROM items");
  console.log(`示例物资已同步；数据库现有 ${count} 种物资。`);
} finally {
  await pool.end();
}
