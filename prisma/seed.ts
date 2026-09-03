// ⚠️ ILLUSTRATIVE / PLACEHOLDER DATA ONLY.
//
// None of the values below (prices, stage list, capital minimums) are
// approved business data. Per the architecture doc's section 11, several of
// these are explicitly open items pending business sign-off. This script
// exists to demonstrate the seeding pattern for reference tables, not to
// populate production-ready content.

// `tsx` does not auto-load .env the way `next dev` or the Prisma CLI do —
// running this file directly (or via `pnpm db:seed`) without this line
// silently connects with an empty DATABASE_URL instead of failing loudly.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ⚠️ LOCAL DEV ONLY — hardcoded weak password for manual RBAC testing.
// Never seed these into a staging/production database.
const DEV_PASSWORD = "DevPassw0rd!";

async function seedTestUsers() {
  const passwordHash = await hashPassword(DEV_PASSWORD);
  const users = [
    { email: "client@leapin.test", name: "Test Client", role: "client" as const },
    { email: "admin@leapin.test", name: "Test Admin", role: "admin" as const },
    { email: "superadmin@leapin.test", name: "Test Super Admin", role: "super_admin" as const },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, isActive: true },
    });
  }
  console.log(`Seeded 3 dev-only test users (password: "${DEV_PASSWORD}").`);
}

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

  await seedTestUsers();

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
