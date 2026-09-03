import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";

export async function PUT() {
  const { session, response } = await requireAuth();
  if (response) return response;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
}
