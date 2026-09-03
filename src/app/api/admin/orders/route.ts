import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  // Per doc §2.1: an admin only ever sees orders assigned to them (via a
  // stage assignment); a super_admin sees everything, optionally filtered
  // by the `assigned_to` query param.
  const assignedTo =
    session.user.role === UserRole.admin
      ? session.user.id
      : new URL(request.url).searchParams.get("assigned_to") || undefined;

  const orders = await prisma.order.findMany({
    where: assignedTo ? { orderStages: { some: { assignedAdminId: assignedTo } } } : undefined,
    include: { orderStages: { include: { stage: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}
