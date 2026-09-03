import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { packageUpdateSchema } from "@/lib/validation/packages";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const pkg = await prisma.package.findUnique({
    where: { id },
    include: { packageStages: true },
  });
  if (!pkg) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ package: pkg });
}

export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = packageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { stages, ...data } = parsed.data;

  const before = await prisma.package.findUnique({
    where: { id },
    include: { packageStages: true },
  });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const pkg = await prisma.$transaction(async (tx) => {
      await tx.package.update({ where: { id }, data });
      if (stages) {
        await tx.packageStage.deleteMany({ where: { packageId: id } });
        if (stages.length > 0) {
          await tx.packageStage.createMany({
            data: stages.map((s) => ({
              packageId: id,
              stageId: s.stageId,
              isOptionalAddon: s.isOptionalAddon,
            })),
          });
        }
      }
      return tx.package.findUniqueOrThrow({
        where: { id },
        include: { packageStages: true },
      });
    });
    await logAudit({
      actorUserId: session.user.id,
      action: "update_package",
      entityType: "package",
      entityId: id,
      oldValue: before,
      newValue: pkg,
    });
    return NextResponse.json({ package: pkg });
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
  const before = await prisma.package.findUnique({
    where: { id },
    include: { packageStages: true },
  });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await prisma.$transaction([
      prisma.packageStage.deleteMany({ where: { packageId: id } }),
      prisma.package.delete({ where: { id } }),
    ]);
    await logAudit({
      actorUserId: session.user.id,
      action: "delete_package",
      entityType: "package",
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
