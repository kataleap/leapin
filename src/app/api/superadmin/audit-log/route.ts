import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { response } = await requireRole([UserRole.super_admin]);
  if (response) return response;

  const take = Math.min(Number(new URL(request.url).searchParams.get("take")) || 100, 200);

  const auditLog = await prisma.auditLog.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: { actorUser: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ auditLog });
}
