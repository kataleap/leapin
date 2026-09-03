import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { documentUploadMetaSchema } from "@/lib/validation/admin-orders";
import { DocumentUploadError, saveUploadedFile } from "@/lib/storage/documents";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  const { id: orderId } = await params;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (session.user.role === UserRole.admin) {
    const isAssigned = await prisma.orderStage.findFirst({
      where: { orderId, assignedAdminId: session.user.id },
    });
    if (!isAssigned) {
      return NextResponse.json({ error: "This order is not assigned to you." }, { status: 403 });
    }
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A 'file' field is required." }, { status: 400 });
  }

  const parsed = documentUploadMetaSchema.safeParse({
    documentType: formData.get("documentType"),
    isVisibleToClient: formData.get("isVisibleToClient"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const saved = await saveUploadedFile(orderId, file);
    const document = await prisma.documentVault.create({
      data: {
        orderId,
        documentType: parsed.data.documentType,
        isVisibleToClient: parsed.data.isVisibleToClient,
        uploadedByAdminId: session.user.id,
        ...saved,
      },
    });
    await logAudit({
      actorUserId: session.user.id,
      action: "upload_document",
      entityType: "document_vault",
      entityId: document.id,
      newValue: document,
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    if (err instanceof DocumentUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
