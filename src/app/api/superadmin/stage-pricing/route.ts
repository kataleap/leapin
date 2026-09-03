import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { stagePricingCreateSchema } from "@/lib/validation/stage-pricing";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const stageId = new URL(request.url).searchParams.get("stageId");
  const stagePricing = await prisma.stagePricing.findMany({
    where: stageId ? { stageId } : undefined,
  });
  return NextResponse.json({ stagePricing });
}

export async function POST(request: Request) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = stagePricingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const pricing = await prisma.stagePricing.create({ data: parsed.data });
    await logAudit({
      actorUserId: session.user.id,
      action: "create_stage_pricing",
      entityType: "stage_pricing",
      entityId: pricing.id,
      newValue: pricing,
    });
    return NextResponse.json({ stagePricing: pricing }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
