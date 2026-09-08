const {
  prisma
} = require("../config/db");

async function health(req, res) {
  let database = "OFFLINE";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "ONLINE";
  } catch (error) {
    database = "OFFLINE";
  }

  res.json({
    success: true,

    status:
      database === "ONLINE"
        ? "OPERATIONAL"
        : "DEGRADED",

    services: {
      api: "ONLINE",
      database,
      // These three are prototype stubs (see services/*.service.js) —
      // they run without crashing but return no real analysis yet.
      // Reporting them as "ONLINE" would be misleading.
      ocr: "PROTOTYPE_STUB",
      forensics: "PROTOTYPE_STUB",
      faceVerification: "PROTOTYPE_STUB",
      riskEngine: "ONLINE"
    }
  });
}

module.exports = {
  health
};