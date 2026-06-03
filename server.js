const path = require("path");
const dotenv = require("dotenv");

// Defaults from `.env.example`, then overridden by `.env` (secrets stay in `.env` only).
dotenv.config({ path: path.join(__dirname, ".env.example") });
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");

const { errorHandler } = require("./src/middleware/errorHandler");
const { bootstrapAll } = require("./src/services/bootstrapService");

const adminRoutes = require("./src/routes/admin.routes");
const rolesRoutes = require("./src/routes/roles.routes");
const usersRoutes = require("./src/routes/users.routes");
const discussRoutes = require("./src/routes/discuss.routes");
const analyticsRoutes = require("./src/routes/analytics.routes");
const sessionRoutes = require("./src/routes/session.routes");
const referralRoutes = require("./src/routes/referral.routes");

const PORT = Number(process.env.ADMIN_PORT) || 4100;
const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();

const app = express();

const originsRaw = String(process.env.ADMIN_CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowAll = originsRaw.includes("*");
app.use(
  cors({
    origin: allowAll ? true : originsRaw.length ? originsRaw : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "admin-backend" });
});

app.use("/admin", adminRoutes);
app.use("/roles", rolesRoutes);
app.use("/users", usersRoutes);
app.use("/discuss", discussRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/sessions", sessionRoutes);
app.use("/referrals", referralRoutes);

app.use(errorHandler);

if (!MONGODB_URI) {
  console.error(
    [
      "[admin] Missing MONGODB_URI.",
      "Create `admin-backend/.env` next to package.json with:",
      "  MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster/DATABASE?retryWrites=true&w=majority",
      "Fastest: copy `.env.example` → `.env` and fill MONGODB_URI (and ADMIN_JWT_SECRET).",
    ].join("\n"),
  );
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("[admin] MongoDB connected");
    await bootstrapAll();
    app.listen(PORT, () => {
      console.log(`[admin] listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[admin] MongoDB connection error", err);
    process.exit(1);
  });
