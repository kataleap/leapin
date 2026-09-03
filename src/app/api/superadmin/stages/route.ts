import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { stageCreateSchema } from "@/lib/validation/stages";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const stages = await prisma.stage.findMany({ orderBy: { sequenceOrder: "asc" } });
  return NextResponse.json({ stages });
}

export async function POST(request: Request) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = stageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const stage = await prisma.stage.create({ data: parsed.data });
    await logAudit({
      actorUserId: session.user.id,
      action: "create_stage",
      entityType: "stage",
      entityId: stage.id,
      newValue: stage,
    });
    return NextResponse.json({ stage }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
