import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { hashPassword } from "@/lib/auth/password";
import { userUpdateSchema } from "@/lib/validation/users";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

const SAFE_SELECT = { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { password, ...rest } = parsed.data;

  // A super_admin editing their own account can't strip their own access —
  // otherwise a single click could lock every super_admin out permanently.
  if (id === session.user.id) {
    if (rest.role !== undefined && rest.role !== UserRole.super_admin) {
      return NextResponse.json({ error: "Cannot change your own role." }, { status: 400 });
    }
    if (rest.isActive === false) {
      return NextResponse.json({ error: "Cannot deactivate your own account." }, { status: 400 });
    }
  }

  const before = await prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const data: Prisma.UserUncheckedUpdateInput = { ...rest };
  if (password) data.passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.update({ where: { id }, data, select: SAFE_SELECT });
    await logAudit({
      actorUserId: session.user.id,
      action: "update_user",
      entityType: "user",
      entityId: id,
      oldValue: before,
      newValue: user,
    });
    return NextResponse.json({ user });
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
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  const before = await prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
  if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await prisma.user.delete({ where: { id } });
    await logAudit({
      actorUserId: session.user.id,
      action: "delete_user",
      entityType: "user",
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
