import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { notifySuperAdmins } from "@/lib/notifications";
import { DocumentUploadError, saveUploadedFile } from "@/lib/storage/documents";

type Params = { params: Promise<{ id: string; installmentNumber: string }> };

// The one place a client uploads a file themselves (documents_vault uploads
// stay admin-only per Phase 2's RBAC) — reuses the same storage helpers,
// stored directly on order_payments rather than in documents_vault.
export async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireAuth();
  if (response) return response;
  if (session.user.role !== UserRole.client) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id: orderId, installmentNumber } = await params;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.clientId !== session.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const payment = await prisma.orderPayment.findUnique({
    where: { orderId_installmentNumber: { orderId, installmentNumber: Number(installmentNumber) } },
  });
  if (!payment) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (payment.dueAt == null || payment.status !== "pending") {
    return NextResponse.json({ error: "This installment is not currently payable." }, { status: 400 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A 'file' field is required." }, { status: 400 });
  }

  try {
    const saved = await saveUploadedFile(orderId, file);
    const updated = await prisma.orderPayment.update({
      where: { id: payment.id },
      data: {
        method: "bank_transfer",
        proofStoragePath: saved.storagePath,
        proofOriginalFileName: saved.originalFileName,
        proofMimeType: saved.mimeType,
        proofUploadedAt: new Date(),
      },
    });
    await logAudit({
      actorUserId: session.user.id,
      action: "upload_payment_proof",
      entityType: "order_payment",
      entityId: payment.id,
      newValue: { proofOriginalFileName: saved.originalFileName },
    });
    await notifySuperAdmins({
      type: "payment_due",
      title: "إيصال تحويل بنكي بحاجة لمراجعة",
      message: `رفع العميل إيصال تحويل للدفعة رقم ${payment.installmentNumber}. يرجى المراجعة والتأكيد.`,
      orderId,
    }).catch(() => {});
    return NextResponse.json({ orderPayment: updated });
  } catch (err) {
    if (err instanceof DocumentUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
