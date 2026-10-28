import assert from "node:assert/strict";
import test from "node:test";
import { normalizePlan } from "../src/ai-plan.js";

test("模型不能引入未知物资、重复申请或自行扩大补货量", () => {
  const inventory = [
    {
      id: 1,
      sku: "A-FAN-03",
      name: "散热风扇",
      unit: "件",
      quantity: 18,
      minQuantity: 25,
    },
    {
      id: 2,
      sku: "D-SHELL-01",
      name: "设备外壳",
      unit: "件",
      quantity: 12,
      minQuantity: 20,
    },
    {
      id: 3,
      sku: "A-MCU-02",
      name: "微控制器",
      unit: "件",
      quantity: 34,
      minQuantity: 20,
    },
  ];
  const open = [{ sku: "D-SHELL-01", status: "PENDING" }];
  const raw = JSON.stringify({
    summary: "微控制器低于安全阈值，请马上采购 999 件",
    items: [
      { sku: "A-FAN-03", priority: "HIGH", quantity: 999, reason: "需关注" },
      { sku: "D-SHELL-01", priority: "HIGH", reason: "重复" },
      { sku: "A-MCU-02", priority: "HIGH", reason: "健康库存" },
      { sku: "UNKNOWN", priority: "HIGH", reason: "不存在" },
    ],
  });
  const plan = normalizePlan(raw, inventory, open);
  assert.deepEqual(
    plan.items.map((row) => row.sku),
    ["A-FAN-03"],
  );
  assert.equal(plan.items[0].quantity, 32);
  assert.equal(plan.items[0].gap, 7);
  assert(!plan.summary.includes("999"));
  assert.equal(plan.excludedOpen[0].sku, "D-SHELL-01");
});
