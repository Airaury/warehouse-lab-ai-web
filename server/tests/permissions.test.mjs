import test from "node:test";
import assert from "node:assert/strict";
import {
  canCreateAccount,
  canManageAccount,
  roleCanAccess,
} from "../src/permissions.js";

test("董事长继承主管业务权限，主管不能管理董事长或同级账号", () => {
  assert.equal(roleCanAccess("CHAIRMAN", ["MANAGER"]), true);
  assert.equal(roleCanAccess("CHAIRMAN", ["MANAGER", "DEPUTY"]), true);
  assert.equal(roleCanAccess("DEPUTY", ["MANAGER"]), false);
  assert.equal(canManageAccount("CHAIRMAN", "MANAGER"), true);
  assert.equal(canManageAccount("MANAGER", "CHAIRMAN"), false);
  assert.equal(canManageAccount("MANAGER", "MANAGER"), false);
  assert.equal(canManageAccount("CHAIRMAN", "CHAIRMAN"), false);
});

test("只有董事长能补建主管，普通账号无法创建高权限角色", () => {
  assert.equal(canCreateAccount("CHAIRMAN", "MANAGER"), true);
  assert.equal(canCreateAccount("MANAGER", "MANAGER"), false);
  assert.equal(canCreateAccount("MANAGER", "DEPUTY"), true);
  assert.equal(canCreateAccount("DEPUTY", "VIEWER"), false);
  assert.equal(canCreateAccount("CHAIRMAN", "CHAIRMAN"), false);
});
