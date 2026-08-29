// ⚠️ ILLUSTRATIVE / PLACEHOLDER DATA ONLY.
//
// None of the values below (prices, stage list, capital minimums) are
// approved business data. Per the architecture doc's section 11, several of
// these are explicitly open items pending business sign-off. This script
// exists to demonstrate the seeding pattern for reference tables, not to
// populate production-ready content.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const regularTrack = await prisma.track.upsert({
    where: { code: "regular_investment" },
    update: {},
    create: {
      code: "regular_investment",
      nameAr: "المسار الاستثماري النظامي", // placeholder wording
      status: "active",
      sortOrder: 1,
    },
  });

  const entrepreneurshipTrack = await prisma.track.upsert({
    where: { code: "entrepreneurship" },
    update: {},
    create: {
      code: "entrepreneurship",
      nameAr: "مسار ريادة الأعمال", // placeholder wording
      status: "active",
      sortOrder: 2,
    },
  });

  // Illustrative stage — the real STAGE_* code list and sequencing is TBD
  // (doc §11), this only demonstrates the seeding pattern.
  await prisma.stage.upsert({
    where: { code: "STAGE_0" },
    update: {},
    create: {
      code: "STAGE_0",
      trackScope: "shared",
      nameAr: "مرحلة تجريبية — للتوضيح فقط",
      sequenceOrder: 0,
      primaryActor: "system",
      requiresClientPresence: false,
      status: "tbd",
    },
  });

  console.log("Seed complete (placeholder data — do not treat as approved).", {
    regularTrack: regularTrack.code,
    entrepreneurshipTrack: entrepreneurshipTrack.code,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
