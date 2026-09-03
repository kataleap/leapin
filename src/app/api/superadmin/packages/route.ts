import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { packageCreateSchema } from "@/lib/validation/packages";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const packages = await prisma.package.findMany({ include: { packageStages: true } });
  return NextResponse.json({ packages });
}

export async function POST(request: Request) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = packageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { stages, ...data } = parsed.data;

  try {
    const pkg = await prisma.$transaction(async (tx) => {
      const created = await tx.package.create({
        data: { ...data, createdByUserId: session.user.id },
      });
      if (stages && stages.length > 0) {
        await tx.packageStage.createMany({
          data: stages.map((s) => ({
            packageId: created.id,
            stageId: s.stageId,
            isOptionalAddon: s.isOptionalAddon,
          })),
        });
      }
      return tx.package.findUniqueOrThrow({
        where: { id: created.id },
        include: { packageStages: true },
      });
    });
    await logAudit({
      actorUserId: session.user.id,
      action: "create_package",
      entityType: "package",
      entityId: pkg.id,
      newValue: pkg,
    });
    return NextResponse.json({ package: pkg }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
