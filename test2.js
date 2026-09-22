const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.screening.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      screeningId: true,
      status: true,
      createdAt: true,
      document: { select: { originalName: true } },
      faceVerification: { select: { similarityScore: true, signal: true } }
    }
  });
  rows.forEach(r => console.log(
    r.createdAt.toISOString(),
    r.screeningId,
    r.status,
    r.document?.originalName,
    r.faceVerification ? `${r.faceVerification.similarityScore} ${r.faceVerification.signal}` : 'no face row'
  ));
}
main().finally(() => prisma.$disconnect());