import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { NATIONALITY_CODES } from "@/lib/reference/nationalities";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// The stored rows are the *exceptions*, so the payload is the barred list:
// eligibility is allow-by-default (see src/lib/orders/country-eligibility.ts),
// and asking a super admin to tick 249 nationalities to open a country would
// guarantee the table goes unmaintained.
const restrictionsSchema = z.object({
  ineligibleNationalityCodes: z.array(z.enum(NATIONALITY_CODES)).max(NATIONALITY_CODES.length),
});

export async function GET(_request: Request, { params }: Params) {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const restrictions = await prisma.countryNationalityRestriction.findMany({
    where: { countryId: id },
    orderBy: { nationalityCode: "asc" },
  });
  return NextResponse.json({ restrictions });
}

export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const country = await prisma.country.findUnique({ where: { id } });
  if (!country) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = restrictionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const codes = [...new Set(parsed.data.ineligibleNationalityCodes)];

  try {
    const before = await prisma.countryNationalityRestriction.findMany({ where: { countryId: id } });

    // Replace-the-set, in one transaction: a half-applied edit would leave a
    // nationality barred from a country the super admin just opened.
    const restrictions = await prisma.$transaction(async (tx) => {
      await tx.countryNationalityRestriction.deleteMany({ where: { countryId: id } });
      if (codes.length > 0) {
        await tx.countryNationalityRestriction.createMany({
          data: codes.map((nationalityCode) => ({ countryId: id, nationalityCode, isEligible: false })),
        });
      }
      return tx.countryNationalityRestriction.findMany({
        where: { countryId: id },
        orderBy: { nationalityCode: "asc" },
      });
    });

    await logAudit({
      actorUserId: session.user.id,
      action: "update_country_nationality_restrictions",
      entityType: "country",
      entityId: id,
      oldValue: before,
      newValue: restrictions,
    });

    return NextResponse.json({ restrictions });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
