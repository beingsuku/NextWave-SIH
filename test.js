const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.faceVerification.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      screening: {
        include: {
          document: {
            select: { originalName: true }
          }
        }
      }
    }
  });

  console.log('| # | Document originalName | similarityScore | rawDistance-equivalent (1 - similarityScore/100) | signal | createdAt |');
  console.log('|---|---|---|---|---|---|');
  rows.forEach((r, idx) => {
    const sim = r.similarityScore;
    const rawDist = sim !== null && sim !== undefined ? (1 - sim / 100).toFixed(4) : 'N/A (null)';
    const simStr = sim !== null && sim !== undefined ? sim.toString() + '%' : 'null';
    const name = (r.screening?.document?.originalName || 'NOT FOUND').replace(/\|/g, '-');
    console.log(`| ${idx + 1} | \`${name}\` | ${simStr} | ${rawDist} | \`${r.signal || 'null'}\` | ${r.createdAt.toISOString()} |`);
  });
}

main().finally(() => prisma.$disconnect());
