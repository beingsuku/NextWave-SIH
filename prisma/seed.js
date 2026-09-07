const bcrypt = require("bcryptjs");

const {
  PrismaClient
} = require("@prisma/client");

const prisma =
  new PrismaClient();

async function main() {
  const passwordHash =
    await bcrypt.hash(
      "sih12345",
      12
    );

  await prisma.officer.upsert({
    where: {
      officerId: "UFS-OFF-9042"
    },

    update: {},

    create: {
      officerId:
        "UFS-OFF-9042",

      name:
        "SIH Demo Officer",

      email:
        "officer@sih.local",

      passwordHash,

      role:
        "OFFICER",

      checkpoint:
        "ICP Attari-Wagah"
    }
  });

  console.log(
    "SIH demo officer created"
  );
}

main()
  .catch(console.error)
  .finally(() =>
    prisma.$disconnect()
  );