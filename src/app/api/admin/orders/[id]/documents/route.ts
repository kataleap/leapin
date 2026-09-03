import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { documentUploadSchema } from "@/lib/validation/admin-orders";

type Params = { params: Promise<{ id: string }> };

// Actual file storage (S3 or similar) is a separate, deferred integration —
// this expects `fileUrl` to already point at a stored file, matching the
// `file_url VARCHAR` shape already established at the DB-layer step.
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

  const body = await request.json().catch(() => null);
  const parsed = documentUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const document = await prisma.documentVault.create({
      data: {
        orderId,
        documentType: parsed.data.documentType,
        fileUrl: parsed.data.fileUrl,
        isVisibleToClient: parsed.data.isVisibleToClient,
        uploadedByAdminId: session.user.id,
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
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
