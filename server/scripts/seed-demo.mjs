import "dotenv/config";
import { pool } from "../src/db.js";
import { hashPassword } from "../src/auth.js";

const password = process.env.DEMO_CHAIRMAN_PASSWORD;
if (!password || password.startsWith("replace-") || password.length < 12 || password.length > 128) {
  throw new Error("请在 server/.env 配置 12—128 位 DEMO_CHAIRMAN_PASSWORD");
}

const tag = "[演示场景]";
const conn = await pool.getConnection();
const created = { account: 0, approvals: 0, replenishments: 0, movements: 0, notifications: 0 };
try {
  await conn.beginTransaction();
  const [[existing]] = await conn.execute(
    "SELECT id,role FROM users WHERE username='chairman_demo' AND deleted_at IS NULL FOR UPDATE",
  );
  if (existing && existing.role !== "DEPUTY") throw new Error("chairman_demo 已存在且权限角色不匹配");
  let userId = existing?.id;
  if (!userId) {
    const [result] = await conn.execute(
      "INSERT INTO users (username,display_name,role,password_hash) VALUES ('chairman_demo','演示董事长','DEPUTY',?)",
      [await hashPassword(password)],
    );
    userId = result.insertId;
    created.account++;
  }

  const [items] = await conn.query("SELECT id,sku,name,quantity,unit FROM items WHERE sku IN ('A-SENSOR-01','B-BAT-01','A-RES-04','A-FAN-03','D-SHELL-01','C-CABLE-01','E-BOARD-01','B-FUSE-04','C-HDMI-03','E-OLED-02') FOR UPDATE");
  const bySku = new Map(items.map((item) => [item.sku, item]));
  const requireItem = (sku) => {
    const item = bySku.get(sku);
    if (!item) throw new Error(`缺少演示物资 ${sku}；请先运行 npm run db:seed`);
    return item;
  };

  for (const [sku, quantity, label] of [
    ["A-SENSOR-01", 60, "教学实验批量领用"],
    ["B-BAT-01", 58, "机器人项目集中出库"],
    ["A-RES-04", 80, "电路实训材料发放"],
  ]) {
    const item = requireItem(sku);
    if (Number(item.quantity) < quantity) throw new Error(`${sku} 当前库存不足以准备演示审批`);
    const note = `${tag}${label}`;
    const [[{ count }]] = await conn.execute("SELECT COUNT(*) AS count FROM approvals WHERE item_id=? AND note=?", [item.id, note]);
    if (!count) {
      await conn.execute("INSERT INTO approvals (item_id,quantity,note) VALUES (?,?,?)", [item.id, quantity, note]);
      created.approvals++;
    }
  }

  for (const [sku, quantity, reason] of [
    ["A-FAN-03", 45, "散热风扇低于安全阈值，等待补货审批"],
    ["D-SHELL-01", 36, "设备外壳不足，保障装配课程"],
    ["B-FUSE-04", 30, "实验耗材下一批次预备补货"],
  ]) {
    const item = requireItem(sku);
    const taggedReason = `${tag}${reason}`;
    const [[{ count }]] = await conn.execute("SELECT COUNT(*) AS count FROM replenishments WHERE item_id=? AND reason=?", [item.id, taggedReason]);
    if (!count) {
      await conn.execute("INSERT INTO replenishments (item_id,quantity,reason,requested_by) VALUES (?,?,?,?)", [item.id, quantity, taggedReason, userId]);
      created.replenishments++;
    }
  }

  for (const [sku, entries] of [
    ["A-SENSOR-01", [["IN", 24, "项目到货验收"], ["OUT", 24, "传感器课程领用"]]],
    ["C-CABLE-01", [["IN", 30, "线材批次入库"], ["OUT", 30, "实验室集中领用"]]],
    ["E-BOARD-01", [["IN", 16, "电路板到货"], ["OUT", 16, "机器人项目领用"]]],
  ]) {
    const item = requireItem(sku);
    const [[{ count }]] = await conn.execute("SELECT COUNT(*) AS count FROM movements WHERE item_id=? AND note LIKE ?", [item.id, `${tag}%`]);
    if (count) continue;
    for (const [index, [direction, quantity, label]] of entries.entries()) {
      await conn.execute(
        "INSERT INTO movements (item_id,direction,quantity,note,created_at) VALUES (?,?,?,?,DATE_SUB(NOW(), INTERVAL ? MINUTE))",
        [item.id, direction, quantity, `${tag}${label}`, 45 - index * 8],
      );
      created.movements++;
    }
  }

  // Leave two uncovered low-stock SKUs so a fresh AI run has real candidates.
  for (const [sku, target, label] of [
    ["C-HDMI-03", 13, "HDMI 线材集中领用后待分析"],
    ["E-OLED-02", 10, "OLED 屏幕课程领用后待分析"],
  ]) {
    const item = requireItem(sku);
    const note = `${tag}${label}`;
    const [[{ count }]] = await conn.execute("SELECT COUNT(*) AS count FROM movements WHERE item_id=? AND note=?", [item.id, note]);
    if (count || Number(item.quantity) <= target) continue;
    const used = Number(item.quantity) - target;
    await conn.execute("UPDATE items SET quantity=quantity-? WHERE id=?", [used, item.id]);
    await conn.execute("INSERT INTO movements (item_id,direction,quantity,note) VALUES (?,'OUT',?,?)", [item.id, used, note]);
    created.movements++;
  }

  const notices = [
    ["MANAGER", "演示审批 · 多条出库待审", "传感器、电池与电阻包的批量出库申请已进入审批队列。", "/approvals"],
    ["MANAGER", "演示补货 · 三项申请待审", "散热风扇、设备外壳和保险丝盒待审核，批准后进入收货流程。", "/approvals"],
    ["ALL", "演示库存 · 低库存风险", "散热风扇和设备外壳低于安全阈值，请结合实时库存核对。", "/inventory"],
    ["ALL", "演示库存 · AI 待分析风险", "HDMI 连接线与 OLED 显示屏低于阈值，尚无进行中补货单。", "/advisor"],
    ["ALL", "演示操作 · 出入库记录", "最近新增了三组可追溯的入库与出库演示记录。", "/operations"],
    ["ALL", "演示引导 · AI 决策闭环", "从风险分析生成草案，人工确认，再到审批、收货与消息反馈。", "/advisor"],
  ];
  for (const [audience, title, body, path] of notices) {
    const [[{ count }]] = await conn.execute("SELECT COUNT(*) AS count FROM notifications WHERE title=?", [title]);
    if (!count) {
      await conn.execute("INSERT INTO notifications (audience,title,body,target_path) VALUES (?,?,?,?)", [audience, title, body, path]);
      created.notifications++;
    }
  }
  await conn.commit();
  console.log(`演示场景已准备：${JSON.stringify(created)}。账号 chairman_demo；密码从私有环境变量读取，未输出。`);
} catch (error) {
  await conn.rollback();
  throw error;
} finally {
  conn.release();
  await pool.end();
}
