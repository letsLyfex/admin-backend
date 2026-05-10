const jwt = require("jsonwebtoken");

function getAccessSecret() {
  const s = String(process.env.ADMIN_JWT_SECRET || "").trim();
  if (!s) throw new Error("ADMIN_JWT_SECRET is not configured");
  return s;
}

function signAdminAccessToken(adminId) {
  return jwt.sign(
    { sub: String(adminId), typ: "admin_access" },
    getAccessSecret(),
    { expiresIn: "1h" },
  );
}

function verifyAdminAccessToken(token) {
  return jwt.verify(String(token || ""), getAccessSecret());
}

module.exports = {
  signAdminAccessToken,
  verifyAdminAccessToken,
};
