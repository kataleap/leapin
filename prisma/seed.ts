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

// Doc §3.2 of مستند_نطاق_المرحلة_الثانية.md: activate "service" + "commercial"
// together this phase; "professional" stays TBD/unactivated, not seeded.
// Both tied to the regular-investment track (architecture doc §5.1).
async function seedActivityClassification(regularTrackId: string) {
  const service = await prisma.activityCategory.upsert({
    where: { trackId_code: { trackId: regularTrackId, code: "service" } },
    update: {},
    create: {
      trackId: regularTrackId,
      code: "service",
      nameAr: "نشاط خدمي", // placeholder wording
      minForeignCompanies: 1,
      minCapitalSar: 100000,
      allowedInEntrepreneurship: true,
      status: "active",
    },
  });

  const commercial = await prisma.activityCategory.upsert({
    where: { trackId_code: { trackId: regularTrackId, code: "commercial" } },
    update: {},
    create: {
      trackId: regularTrackId,
      code: "commercial",
      nameAr: "نشاط تجاري", // placeholder wording
      minForeignCompanies: 3, // 1 primary + 2 subsidiary, per doc §3.2
      minCapitalSar: 30000000,
      allowedInEntrepreneurship: false,
      status: "active",
    },
  });

  // Mixing matrix (doc §3.2): commercial can add service; service adds
  // nothing else; professional stays fully isolated (moot — not activated).
  await prisma.activityMixingRule.upsert({
    where: { baseCategoryId_addableCategoryId: { baseCategoryId: commercial.id, addableCategoryId: service.id } },
    update: {},
    create: { baseCategoryId: commercial.id, addableCategoryId: service.id, isAllowed: true },
  });

  // Illustrative placeholder activities only — the real MISA-sourced list is
  // a separate operational task (doc §3.3), not part of this technical
  // delivery. `Activity` has no natural unique key besides `id`, so guard
  // with a lookup instead of `upsert`.
  const placeholderActivities: { categoryId: string; misaActivityCode: string; nameAr: string; nameEn: string }[] = [
    { categoryId: service.id, misaActivityCode: "SRV-0001", nameAr: "نشاط خدمي تجريبي 1", nameEn: "Sample service activity 1" },
    { categoryId: service.id, misaActivityCode: "SRV-0002", nameAr: "نشاط خدمي تجريبي 2", nameEn: "Sample service activity 2" },
    { categoryId: commercial.id, misaActivityCode: "COM-0001", nameAr: "نشاط تجاري تجريبي 1", nameEn: "Sample commercial activity 1" },
    { categoryId: commercial.id, misaActivityCode: "COM-0002", nameAr: "نشاط تجاري تجريبي 2", nameEn: "Sample commercial activity 2" },
  ];
  for (const a of placeholderActivities) {
    const existing = await prisma.activity.findFirst({
      where: { categoryId: a.categoryId, misaActivityCode: a.misaActivityCode },
    });
    if (!existing) {
      await prisma.activity.create({ data: a });
    }
  }

  console.log("Seeded activity classification (service + commercial categories, mixing rule, placeholder activities).");
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

  await seedActivityClassification(regularTrack.id);
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
