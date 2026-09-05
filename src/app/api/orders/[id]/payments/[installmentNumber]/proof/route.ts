import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { privateFileResponse, readStoredFile } from "@/lib/storage/documents";

type Params = { params: Promise<{ id: string; installmentNumber: string }> };

// Per-user private bytes on a fixed URL — never let this response be cached
// and replayed to whoever requests the same path next.
export const dynamic = "force-dynamic";

// Mirrors /api/documents/[id]/file's RBAC exactly.
export async function GET(_request: Request, { params }: Params) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const { id: orderId, installmentNumber } = await params;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { role, id: userId } = session.user;
  if (role === UserRole.client) {
    if (order.clientId !== userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  } else if (!(await canStaffAccessOrder(orderId, session))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const payment = await prisma.orderPayment.findUnique({
    where: { orderId_installmentNumber: { orderId, installmentNumber: Number(installmentNumber) } },
  });
  if (!payment?.proofStoragePath) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const buffer = await readStoredFile(payment.proofStoragePath);
  return privateFileResponse(buffer, {
    mimeType: payment.proofMimeType,
    fileName: payment.proofOriginalFileName ?? "receipt",
  });
}
