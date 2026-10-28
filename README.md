# 仓序 LAB · 实验室物资风险与补货决策助手

基于实验二仓库管理网页扩展的 Vue 3 + Express API + MySQL 作品原型，面向实验室与创客空间的物资管理者。DeepSeek 只由服务端调用，浏览器不会收到模型密钥。当前物资与历史记录为演示数据。

## 业务流程

库存预警 → AI 分析师调用只读工具核对库存、近期出入库、进行中补货 → 结构化草案与实际工具记录保存到 MySQL → 仓管员或主管逐项确认 → 主管审批 → 仓管员确认收货 → 库存、消息与统计更新。普通出入库直接登记；超过 50 的出库先经过主管审批。AI 本身没有写库工具。建议量由服务端按 `max(1, 2 × 安全阈值 − 当前库存)` 计算，提交时重新检查库存、重复申请和草案有效期（24 小时）。

## 岗位与页面

| 岗位 | 页面与权限 |
| --- | --- |
| 主管 `MANAGER` | 全部页面；审批出库和补货、创建账号、登记操作 |
| 仓管员 `OPERATOR` | 总览、库存、出入库、补货、统计、AI、消息；可申请和收货 |
| 观察员 `VIEWER` | 总览、库存、统计、AI、消息；可生成草案但不能提交申请 |

页面使用 Vue Router：`/`、`/inventory`、`/operations`、`/replenishments`、`/approvals`、`/analytics`、`/advisor`、`/notifications`、`/users`、`/login`。前端路由和服务端权限同时限制操作。登录使用服务端随机会话、`HttpOnly`/`SameSite=Strict` Cookie；密码在 MySQL 中保存为 scrypt 加盐散列。

## 本机运行

1. 安装 Node.js 20+ 和 MySQL 8。使用 MySQL 管理员以 UTF-8 编码执行 [`server/schema.sql`](server/schema.sql)（MySQL CLI 请加 `--default-character-set=utf8mb4`）；重复执行不会重复插入演示物资。已有旧版数据库也需要重新执行此文件，以增加 AI 草案审计表。也可在私有环境变量中提供 `DB_ADMIN_USER`、`DB_ADMIN_PASSWORD` 后运行 `npm run db:migrate -w server`。建表账号只用于迁移。
2. 复制 `server/.env.example` 为 `server/.env`。填写 `DB_USER`、`DB_PASSWORD`、`BOOTSTRAP_MANAGER_PASSWORD`（至少 12 位）、`AI_API_KEY`。如果沿用旧环境文件，首次创建主管时也可读取原有 `ADMIN_TOKEN` 作为初始密码；后续认证已不使用该口令。
3. MySQL 应用账号需要 `ai_warehouse` 上的 `SELECT, INSERT, UPDATE`，以及 `ai_warehouse.sessions` 上的 `DELETE`。`schema.sql` 末尾有授权示例。数据库管理员账号只用于建表，不用于日常 API 运行。
4. 在项目根目录运行 `npm install`、`npm run dev`，打开 `http://127.0.0.1:5173/`。首次启动会在用户表为空时创建账号 `admin`，密码为私有环境变量中的初始密码。主管登录后可在“账号管理”创建其他岗位账号。

```text
client (Vue 3 / Vue Router / Vite) → /api (Express) → MySQL 8
                                            └──────→ DeepSeek Chat Completions
```

服务端默认监听 `127.0.0.1:3001`，Vite 将 `/api` 代理到该端口。查看 `GET /api/health` 可确认数据库和 AI 配置状态。密钥只能写入忽略的 `server/.env` 或部署平台环境变量，绝不能写进 `VITE_` 前缀变量、浏览器源码、截图、公开仓库或演示资料。已在聊天或旧实验中暴露过的密钥应在服务商后台轮换。

## 验证

从根目录运行 `npm run build`；服务启动后在 `server` 目录运行 `node scripts/smoke.mjs`，将真实测试补货 1 单位并通过出库还原库存。设置私有环境变量 `RUN_AI=1` 可验证旧问答接口，`RUN_AI_PLAN=1` 可验证真实 DeepSeek 工具调用、草案、确认、审批、收货与库存还原。如现有主管密码与启动环境变量不同，可在本地设置 `SMOKE_SESSION=1` 使用五分钟测试会话；这会跳过登录密码检查，但仍检查会话与角色保护。测试保留申请、工具记录、消息和出入库审计记录。

## 参赛材料

逐项对照与剩余差距见 [`docs/参赛标准差距分析.md`](docs/参赛标准差距分析.md)。提交前仍需准备 5–8 分钟、至少 1080p 的 MP4 演示和不超过 30 页的 PDF 技术文档；团队信息、真实用户验证、公开仓库及演示地址由参赛团队补齐。
