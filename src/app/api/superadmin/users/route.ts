import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { hashPassword } from "@/lib/auth/password";
import { userCreateSchema } from "@/lib/validation/users";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

const SAFE_SELECT = { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } as const;

export async function GET() {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const users = await prisma.user.findMany({ select: SAFE_SELECT, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { session, response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { name, email, password, role } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, isActive: true },
      select: SAFE_SELECT,
    });
    await logAudit({
      actorUserId: session.user.id,
      action: "create_user",
      entityType: "user",
      entityId: user.id,
      newValue: user,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
