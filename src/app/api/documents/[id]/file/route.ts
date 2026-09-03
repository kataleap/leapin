import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { readStoredFile } from "@/lib/storage/documents";

type Params = { params: Promise<{ id: string }> };

// Protected file serving — never expose documents_vault files via a public
// URL. RBAC here mirrors src/lib/orders/get-order-for-viewer.ts: super_admin
// sees everything, admin only documents on orders assigned to them, client
// only documents marked isVisibleToClient on their own orders.
export async function GET(_request: Request, { params }: Params) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const document = await prisma.documentVault.findUnique({
    where: { id },
    include: { order: true },
  });
  if (!document) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { role, id: userId } = session.user;
  if (role === UserRole.client) {
    if (!document.isVisibleToClient || document.order.clientId !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  } else if (role === UserRole.admin) {
    const isAssigned = await prisma.orderStage.findFirst({
      where: { orderId: document.orderId, assignedAdminId: userId },
    });
    if (!isAssigned) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }
  // super_admin: no further check.

  const buffer = await readStoredFile(document.storagePath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.originalFileName)}"`,
      "Content-Length": String(document.fileSizeBytes),
    },
  });
}
