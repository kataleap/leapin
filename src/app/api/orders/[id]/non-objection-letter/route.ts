import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { notifyOrderStaff } from "@/lib/notifications";
import { canClientSubmitNonObjectionLetter } from "@/lib/orders/non-objection";
import { DocumentUploadError, saveUploadedFile } from "@/lib/storage/documents";

type Params = { params: Promise<{ id: string }> };

// The client uploads the letter their employer issued. Separate from the
// general client-documents route because this one is not a loose attachment:
// it satisfies a specific, recorded requirement on the order, and uploading it
// moves that requirement's own state machine.
export async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireAuth();
  if (response) return response;

  if (session.user.role !== UserRole.client) {
    return NextResponse.json({ error: "Only the client submits this letter." }, { status: 403 });
  }

  const { id: orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, clientId: true, nonObjectionLetters: true },
  });
  if (!order || order.clientId !== session.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const letter = order.nonObjectionLetters[0];
  if (!letter) {
    // Orders created before this feature have no row at all.
    return NextResponse.json(
      { error: "لا يوجد اشتراط خطاب عدم ممانعة مسجَّل على هذا الطلب." },
      { status: 409 }
    );
  }

  const verdict = canClientSubmitNonObjectionLetter(letter);
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 409 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A 'file' field is required." }, { status: 400 });
  }

  try {
    const saved = await saveUploadedFile(orderId, file);

    // The file lands in the vault and the letter points at it, in one
    // transaction: a letter marked `under_review` whose document write failed
    // would send an admin looking for a file that does not exist.
    const updated = await prisma.$transaction(async (tx) => {
      const document = await tx.documentVault.create({
        data: {
          orderId,
          documentType: "non_objection_letter",
          isVisibleToClient: true,
          uploadedByClientId: session.user.id,
          ...saved,
        },
      });
      return tx.nonObjectionLetter.update({
        where: { id: letter.id },
        data: {
          documentId: document.id,
          status: "under_review",
          submittedAt: new Date(),
          // A re-upload after a rejection starts a clean review: the previous
          // reviewer's verdict does not carry over to a new document.
          reviewedAt: null,
          reviewedByAdminId: null,
          reviewNote: null,
        },
        include: { document: true },
      });
    });

    await logAudit({
      actorUserId: session.user.id,
      action: "submit_non_objection_letter",
      entityType: "non_objection_letter",
      entityId: letter.id,
      oldValue: letter,
      newValue: updated,
    });

    await notifyOrderStaff(orderId, {
      type: "client_submission",
      title: "العميل رفع خطاب عدم ممانعة",
      message: "رفع العميل خطاب عدم الممانعة من صاحب العمل — بانتظار مراجعتكم.",
    }).catch(() => {});

    return NextResponse.json({ nonObjectionLetter: updated }, { status: 201 });
  } catch (err) {
    if (err instanceof DocumentUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
