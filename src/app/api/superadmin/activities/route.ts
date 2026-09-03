import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { activityCreateSchema } from "@/lib/validation/activities";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const categoryId = new URL(request.url).searchParams.get("category");
  const activities = await prisma.activity.findMany({
    where: categoryId ? { categoryId } : undefined,
    include: { category: true },
  });
  return NextResponse.json({ activities });
}

export async function POST(request: Request) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = activityCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // No direct MISA API integration this phase (doc §3.3) — manual entry
    // via this endpoint *is* the sync mechanism, so stamp it as such.
    const activity = await prisma.activity.create({
      data: { ...parsed.data, lastSyncedAt: new Date(), syncedByAdminId: session.user.id },
    });
    await logAudit({
      actorUserId: session.user.id,
      action: "create_activity",
      entityType: "activity",
      entityId: activity.id,
      newValue: activity,
    });
    return NextResponse.json({ activity }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
