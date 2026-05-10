const path = require("path");
const fs = require("fs");

/**
 * Resolves the main Lyfex backend root so we can require shared Mongoose models
 * without duplicating schema definitions.
 */
function getMainBackendRoot() {
  const envPath = String(process.env.LYFEX_MAIN_BACKEND_ROOT || "").trim();
  if (envPath && fs.existsSync(path.join(envPath, "src", "models"))) {
    return path.resolve(envPath);
  }
  return path.resolve(__dirname, "..", "..", "..", "Lyfex-backend");
}

function mainModel(modelFileName) {
  const root = getMainBackendRoot();
  const p = path.join(root, "src", "models", modelFileName);
  return require(p);
}

module.exports = { getMainBackendRoot, mainModel };
