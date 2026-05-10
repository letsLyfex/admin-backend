function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0].trim().slice(0, 64);
  }
  const ip = req.socket?.remoteAddress || req.ip || "";
  return String(ip).replace(/^::ffff:/, "").slice(0, 64);
}

module.exports = { getClientIp };
