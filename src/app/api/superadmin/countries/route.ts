import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { countryCreateSchema } from "@/lib/validation/countries";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const countries = await prisma.country.findMany();
  return NextResponse.json({ countries });
}

export async function POST(request: Request) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = countryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const country = await prisma.country.create({ data: parsed.data });
    await logAudit({
      actorUserId: session.user.id,
      action: "create_country",
      entityType: "country",
      entityId: country.id,
      newValue: country,
    });
    return NextResponse.json({ country }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
