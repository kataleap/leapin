import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";

type Params = { params: Promise<{ id: string }> };

export async function PUT(_request: Request, { params }: Params) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (notification.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
  return NextResponse.json({ notification: updated });
}
