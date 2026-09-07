const crypto = require("crypto");
const { prisma } = require("../config/db");

async function createAudit({
  officerId,
  screeningId,
  action,
  details,
  ipAddress,
  userAgent
}) {
  const payload = JSON.stringify({
    officerId,
    screeningId,
    action,
    details,
    timestamp: new Date().toISOString()
  });

  const hash =
    crypto
      .createHash("sha256")
      .update(payload)
      .digest("hex");

  return prisma.auditLog.create({
    data: {
      officerId,
      screeningId,
      action,
      details,
      ipAddress,
      userAgent,
      hash
    }
  });
}

module.exports = {
  createAudit
};