import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import { signToken, setAuthCookie, requireAuth } from "../auth.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20, // 20 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

router.post("/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password" });
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ id: user.id, name: user.display_name, role: user.role });
});

router.post("/logout", (req, res) => {
  const cross = process.env.NODE_ENV === "production";
  res.clearCookie("portal_token", { httpOnly: true, secure: cross, sameSite: cross ? "none" : "lax" });
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20, // 20 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

router.post("/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password" });
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ id: user.id, name: user.display_name, role: user.role });
});

router.post("/logout", (req, res) => {
  res.clearCookie("portal_token");
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;
