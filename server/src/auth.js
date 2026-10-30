import {
  randomBytes,
  scrypt as scryptCallback,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { pool } from "./db.js";
import { roleCanAccess } from "./permissions.js";

const scrypt = promisify(scryptCallback);
const cookieName = "warehouse_session";
const maxAgeSeconds = 60 * 60 * 12;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hex] = String(stored || "").split(":");
  if (!salt || !hex || hex.length !== 128) return false;
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(req) {
  const secure = req.secure || req.get("x-forwarded-proto") === "https";
  return `HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

export function sameOrigin(req, res, next) {
  const origin = req.get("origin");
  const host = req.get("host");
  if (origin) {
    try {
      if (
        new URL(origin).host !== host &&
        !["http://127.0.0.1:5173", "http://localhost:5173"].includes(origin)
      ) {
        return res.status(403).json({ error: "跨站请求已拒绝" });
      }
    } catch {
      return res.status(403).json({ error: "请求来源无效" });
    }
  }
  next();
}

export async function bootstrapManager() {
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM users");
  if (rows[0].count) return;
  const initialPassword =
    process.env.BOOTSTRAP_MANAGER_PASSWORD || process.env.ADMIN_TOKEN;
  if (
    !initialPassword ||
    initialPassword.startsWith("replace-") ||
    initialPassword.length < 12
  ) {
    throw new Error("首次启动请配置 BOOTSTRAP_MANAGER_PASSWORD（至少 12 位）");
  }
  const passwordHash = await hashPassword(initialPassword);
  await pool.execute(
    "INSERT INTO users (username,display_name,role,password_hash) VALUES ('admin','仓库主管','MANAGER',?)",
    [passwordHash],
  );
  console.log("已创建初始主管账号 admin；请使用私有环境变量中的初始密码登录");
}

export function authRoutes(app) {
  const loginAttempts = new Map();
  app.post("/api/auth/login", sameOrigin, async (req, res, next) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const key = req.ip;
    const now = Date.now();
    const recent = (loginAttempts.get(key) || []).filter(
      (at) => now - at < 60_000,
    );
    if (recent.length >= 8)
      return res.status(429).json({ error: "尝试过于频繁，请稍后重试" });
    recent.push(now);
    loginAttempts.set(key, recent);
    try {
      const [[user]] = await pool.execute(
        "SELECT id,username,display_name AS displayName,role,password_hash AS passwordHash FROM users WHERE username=? AND deleted_at IS NULL",
        [username],
      );
      if (!user || !(await verifyPassword(password, user.passwordHash)))
        return res.status(401).json({ error: "账号或密码不正确" });
      loginAttempts.delete(key);
      const token = randomBytes(32).toString("hex");
      await pool.execute(
        "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 12 HOUR))",
        [tokenHash(token), user.id],
      );
      res.setHeader(
        "Set-Cookie",
        `${cookieName}=${token}; ${cookieOptions(req)}`,
      );
      res.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/auth/me", requireAuth, (req, res) =>
    res.json({ user: req.user }),
  );
  app.post(
    "/api/auth/logout",
    requireAuth,
    sameOrigin,
    async (req, res, next) => {
      try {
        await pool.execute("DELETE FROM sessions WHERE token_hash=?", [
          req.sessionHash,
        ]);
        res.setHeader(
          "Set-Cookie",
          `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`,
        );
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );
  app.post(
    "/api/auth/change-password",
    requireAuth,
    sameOrigin,
    async (req, res, next) => {
      const currentPassword = String(req.body.currentPassword || "");
      const newPassword = String(req.body.newPassword || "");
      if (
        !currentPassword ||
        newPassword.length < 12 ||
        newPassword.length > 128
      )
        return res
          .status(400)
          .json({ error: "请填写当前密码和 12—128 位新密码" });
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [[user]] = await conn.execute(
          "SELECT password_hash AS passwordHash FROM users WHERE id=? AND deleted_at IS NULL FOR UPDATE",
          [req.user.id],
        );
        if (
          !user ||
          !(await verifyPassword(currentPassword, user.passwordHash))
        ) {
          await conn.rollback();
          return res.status(403).json({ error: "当前密码不正确" });
        }
        if (await verifyPassword(newPassword, user.passwordHash)) {
          await conn.rollback();
          return res.status(400).json({ error: "新密码不能与当前密码相同" });
        }
        await conn.execute("UPDATE users SET password_hash=? WHERE id=?", [
          await hashPassword(newPassword),
          req.user.id,
        ]);
        await conn.execute(
          "DELETE FROM sessions WHERE user_id=? AND token_hash<>?",
          [req.user.id, req.sessionHash],
        );
        await conn.commit();
        res.json({ message: "密码已更新，其他设备的会话已退出" });
      } catch (error) {
        await conn.rollback();
        next(error);
      } finally {
        conn.release();
      }
    },
  );
}

export async function requireAuth(req, res, next) {
  const raw = req
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!raw || !/^[a-f0-9]{64}$/.test(raw))
    return res.status(401).json({ error: "请先登录" });
  try {
    const hash = tokenHash(raw);
    const [[user]] = await pool.execute(
      "SELECT u.id,u.username,u.display_name AS displayName,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW() AND u.deleted_at IS NULL",
      [hash],
    );
    if (!user) return res.status(401).json({ error: "登录已过期，请重新登录" });
    req.user = user;
    req.sessionHash = hash;
    next();
  } catch (error) {
    next(error);
  }
}

export function roles(...allowed) {
  return (req, res, next) =>
    roleCanAccess(req.user?.role, allowed)
      ? next()
      : res.status(403).json({ error: "当前角色无权执行此操作" });
}
