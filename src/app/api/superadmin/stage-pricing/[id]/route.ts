import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { stagePricingUpdateSchema } from "@/lib/validation/stage-pricing";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const stagePricing = await prisma.stagePricing.findUnique({ where: { id } });
  if (!stagePricing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ stagePricing });
}

export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = stagePricingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const before = await prisma.stagePricing.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const stagePricing = await prisma.stagePricing.update({ where: { id }, data: parsed.data });
    await logAudit({
      actorUserId: session.user.id,
      action: "update_stage_pricing",
      entityType: "stage_pricing",
      entityId: id,
      oldValue: before,
      newValue: stagePricing,
    });
    return NextResponse.json({ stagePricing });
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
  const before = await prisma.stagePricing.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await prisma.stagePricing.delete({ where: { id } });
    await logAudit({
      actorUserId: session.user.id,
      action: "delete_stage_pricing",
      entityType: "stage_pricing",
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
