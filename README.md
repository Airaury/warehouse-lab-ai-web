# 仓序 · AI 智能仓库

基于实验二仓库管理网页扩展的 Vue 3 + Express API + MySQL 作品原型。DeepSeek 只由服务端调用，浏览器不会收到模型密钥。项目数据为演示数据。

## 业务流程

库存预警 → 仓管员申请补货 → 主管审批 → 仓管员确认收货 → MySQL 更新库存与出入库记录 → 消息与统计同步更新。普通出入库直接登记；超过 50 的出库先经过主管审批。AI 仓储运营分析师读取当前库存、近期出入库及进行中的申请，给出有 SKU 和数字依据的建议，不直接修改业务数据。

## 岗位与页面

| 岗位 | 页面与权限 |
| --- | --- |
| 主管 `MANAGER` | 全部页面；审批出库和补货、创建账号、登记操作 |
| 仓管员 `OPERATOR` | 总览、库存、出入库、补货、统计、AI、消息；可申请和收货 |
| 观察员 `VIEWER` | 总览、库存、统计、AI、消息；只读业务数据 |

页面使用 Vue Router：`/`、`/inventory`、`/operations`、`/replenishments`、`/approvals`、`/analytics`、`/advisor`、`/notifications`、`/users`、`/login`。前端路由和服务端权限同时限制操作。登录使用服务端随机会话、`HttpOnly`/`SameSite=Strict` Cookie；密码在 MySQL 中保存为 scrypt 加盐散列。

## 本机运行

1. 安装 Node.js 20+ 和 MySQL 8。使用 MySQL 管理员执行 [`server/schema.sql`](server/schema.sql)；重复执行不会重复插入演示物资。已有旧版数据库也需要重新执行此文件以增加账号、会话、补货与消息表。
2. 复制 `server/.env.example` 为 `server/.env`。填写 `DB_USER`、`DB_PASSWORD`、`BOOTSTRAP_MANAGER_PASSWORD`（至少 12 位）、`AI_API_KEY`。如果沿用旧环境文件，首次创建主管时也可读取原有 `ADMIN_TOKEN` 作为初始密码；后续认证已不使用该口令。
3. MySQL 应用账号需要 `ai_warehouse` 上的 `SELECT, INSERT, UPDATE`，以及 `ai_warehouse.sessions` 上的 `DELETE`。`schema.sql` 末尾有授权示例。数据库管理员账号只用于建表，不用于日常 API 运行。
4. 在项目根目录运行 `npm install`、`npm run dev`，打开 `http://127.0.0.1:5173/`。首次启动会在用户表为空时创建账号 `admin`，密码为私有环境变量中的初始密码。主管登录后可在“账号管理”创建其他岗位账号。

```text
client (Vue 3 / Vue Router / Vite) → /api (Express) → MySQL 8
                                            └──────→ DeepSeek Chat Completions
```

服务端默认监听 `127.0.0.1:3001`，Vite 将 `/api` 代理到该端口。查看 `GET /api/health` 可确认数据库和 AI 配置状态。密钥只能写入忽略的 `server/.env` 或部署平台环境变量，绝不能写进 `VITE_` 前缀变量、浏览器源码、截图、公开仓库或演示资料。已在聊天或旧实验中暴露过的密钥应在服务商后台轮换。

## 验证

从根目录运行 `npm run build`；服务启动后在 `server` 目录运行 `node scripts/smoke.mjs`，将真实测试补货 1 单位并通过出库还原库存。设置私有环境变量 `RUN_AI=1` 可额外验证 DeepSeek 请求。测试会保留申请、消息和出入库审计记录。

## 参赛材料

逐项对照与剩余差距见 [`docs/参赛标准差距分析.md`](docs/参赛标准差距分析.md)。提交前仍需准备 5–8 分钟、至少 1080p 的 MP4 演示和不超过 30 页的 PDF 技术文档；团队信息、真实用户验证、公开仓库及演示地址由参赛团队补齐。
