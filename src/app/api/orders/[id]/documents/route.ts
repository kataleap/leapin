import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { notifyOrderStaff } from "@/lib/notifications";
import { canClientUploadDocuments, CLIENT_DOCUMENT_TYPE_LABEL } from "@/lib/orders/client-actions";
import { clientDocumentUploadMetaSchema } from "@/lib/validation/client-orders";
import { DocumentUploadError, saveUploadedFile } from "@/lib/storage/documents";

type Params = { params: Promise<{ id: string }> };

// The client's own upload point (phase-2 scope §4.2). Deliberately separate
// from the admin route rather than a role branch inside it: the two differ in
// who may call them, which document types are legal, and who decides
// visibility — three divergences that would each become an `if (isClient)`
// in a shared handler.
export async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireAuth();
  if (response) return response;

  // Staff have their own upload route, with their own document types and
  // their own visibility decision; this one is the client's.
  if (session.user.role !== UserRole.client) {
    return NextResponse.json(
      { error: "Staff upload documents through the admin order view." },
      { status: 403 }
    );
  }

  const { id: orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, clientId: true, status: true },
  });
  // 404 rather than 403 for someone else's order — an id a client does not own
  // should not be confirmable as existing.
  if (!order || order.clientId !== session.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const verdict = canClientUploadDocuments(order.status);
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 409 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A 'file' field is required." }, { status: 400 });
  }

  const parsed = clientDocumentUploadMetaSchema.safeParse({
    documentType: formData.get("documentType"),
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
        // Not taken from the request: a client's own document is always
        // visible to them, and nothing a client sends may decide visibility
        // for anyone.
        isVisibleToClient: true,
        uploadedByClientId: session.user.id,
        ...saved,
      },
    });

    await logAudit({
      actorUserId: session.user.id,
      action: "client_upload_document",
      entityType: "document_vault",
      entityId: document.id,
      newValue: document,
    });

    // Doc §10.2: staff are told when an action is awaiting them. A document
    // that lands with nobody notified is the same as no document at all.
    await notifyOrderStaff(orderId, {
      type: "client_submission",
      title: "العميل رفع مستندًا",
      message: `رفع العميل مستندًا من نوع «${CLIENT_DOCUMENT_TYPE_LABEL[parsed.data.documentType]}».`,
    }).catch(() => {});

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
