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
      ocr: "ONLINE",
      forensics: "ONLINE",
      faceVerification: "ONLINE",
      riskEngine: "ONLINE"
    }
  });
}

module.exports = {
  health
};