import jwt from "jsonwebtoken";
import "dotenv/config";

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.includes("replace-this")) {
  console.warn("[WARN] JWT_SECRET is not set to a real secret. Set it in server/.env before deploying.");
}

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.display_name }, SECRET, { expiresIn: "12h" });
}

export function setAuthCookie(res, token) {
  res.cookie("portal_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.portal_token;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired, please sign in again" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin access only" });
  next();
}
