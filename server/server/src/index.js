import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import cron from "node-cron";
import "dotenv/config";

import "./db.js";
import authRoutes from "./routes/auth.js";
import positionsRoutes from "./routes/positions.js";
import adminRoutes from "./routes/admin.js";
import { refreshAllPrices } from "./services/priceFeed.js";

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/positions", positionsRoutes);
app.use("/api/admin", adminRoutes);

// Refresh prices on boot, then on a schedule (default every 15 minutes).
const minutes = Number(process.env.PRICE_REFRESH_MINUTES || 15);
refreshAllPrices().then((r) => console.log(`[prices] initial refresh: ${r.ok.length} ok, ${r.failed.length} failed`));
cron.schedule(`*/${minutes} * * * *`, async () => {
  const r = await refreshAllPrices();
  console.log(`[prices] refreshed: ${r.ok.length} ok, ${r.failed.length} failed`);
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Investor portal API listening on :${port}`));
