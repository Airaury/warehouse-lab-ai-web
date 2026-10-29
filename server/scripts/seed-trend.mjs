import "dotenv/config";
import { pool } from "../src/db.js";

const conn = await pool.getConnection();
let seeded = 0;
try {
  await conn.beginTransaction();
  const [items] = await conn.query("SELECT id,quantity FROM items ORDER BY id");
  for (const item of items) {
    const current = Number(item.quantity);
    if (current < 8) continue;
    const [[{ count }]] = await conn.execute(
      "SELECT COUNT(*) AS count FROM movements WHERE item_id=? AND note LIKE '演示历史波动%'",
      [item.id],
    );
    if (count) continue;
    const step = Math.max(2, Math.min(20, Math.round(current * 0.18)));
    const entries = [
      [12, "OUT", step],
      [10, "IN", step * 2],
      [8, "OUT", step],
      [6, "IN", step],
      [4, "OUT", step],
    ];
    for (const [daysAgo, direction, quantity] of entries) {
      await conn.execute(
        "INSERT INTO movements (item_id,direction,quantity,note,created_at) VALUES (?,?,?,'演示历史波动 · 初始样本',DATE_ADD(DATE_SUB(CURDATE(), INTERVAL ? DAY), INTERVAL 12 HOUR))",
        [item.id, direction, quantity, daysAgo],
      );
    }
    seeded++;
  }
  await conn.commit();
  console.log(`已为 ${seeded} 种物资写入可追溯的演示历史波动；每种物资净变化为 0，当前库存未改变。`);
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
  await pool.end();
}
