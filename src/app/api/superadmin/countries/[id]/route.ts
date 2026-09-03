import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { countryUpdateSchema } from "@/lib/validation/countries";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const country = await prisma.country.findUnique({ where: { id } });
  if (!country) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ country });
}

export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = countryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const before = await prisma.country.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const country = await prisma.country.update({ where: { id }, data: parsed.data });
    await logAudit({
      actorUserId: session.user.id,
      action: "update_country",
      entityType: "country",
      entityId: id,
      oldValue: before,
      newValue: country,
    });
    return NextResponse.json({ country });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const before = await prisma.country.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await prisma.country.delete({ where: { id } });
    await logAudit({
      actorUserId: session.user.id,
      action: "delete_country",
      entityType: "country",
      entityId: id,
      oldValue: before,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
