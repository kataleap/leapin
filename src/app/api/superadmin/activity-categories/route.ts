import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { activityCategoryCreateSchema } from "@/lib/validation/activity-categories";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const categories = await prisma.activityCategory.findMany({ include: { track: true } });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = activityCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const category = await prisma.activityCategory.create({ data: parsed.data });
    await logAudit({
      actorUserId: session.user.id,
      action: "create_activity_category",
      entityType: "activity_category",
      entityId: category.id,
      newValue: category,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
