import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { activityMixingRuleUpdateSchema } from "@/lib/validation/activity-mixing-rules";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const rule = await prisma.activityMixingRule.findUnique({
    where: { id },
    include: { baseCategory: true, addableCategory: true },
  });
  if (!rule) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ rule });
}

export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = activityMixingRuleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const before = await prisma.activityMixingRule.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const rule = await prisma.activityMixingRule.update({ where: { id }, data: parsed.data });
    await logAudit({
      actorUserId: session.user.id,
      action: "update_activity_mixing_rule",
      entityType: "activity_mixing_rule",
      entityId: id,
      oldValue: before,
      newValue: rule,
    });
    return NextResponse.json({ rule });
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
  const before = await prisma.activityMixingRule.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await prisma.activityMixingRule.delete({ where: { id } });
    await logAudit({
      actorUserId: session.user.id,
      action: "delete_activity_mixing_rule",
      entityType: "activity_mixing_rule",
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
