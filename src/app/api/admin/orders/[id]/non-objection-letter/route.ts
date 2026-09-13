import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { createNotification } from "@/lib/notifications";
import { canStaffReviewNonObjectionLetter } from "@/lib/orders/non-objection";

type Params = { params: Promise<{ id: string }> };

const reviewSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    reviewNote: z.string().trim().max(500).optional(),
  })
  // A rejection the client cannot act on is a dead end — they need to know
  // what was wrong with the letter before asking their employer for another.
  .refine((d) => d.status !== "rejected" || (d.reviewNote && d.reviewNote.length > 0), {
    message: "A rejection must say why.",
    path: ["reviewNote"],
  });

export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  const { id: orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, clientId: true, nonObjectionLetters: true },
  });
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!(await canStaffAccessOrder(orderId, session))) {
    return NextResponse.json({ error: "This order is not assigned to you." }, { status: 403 });
  }

  const letter = order.nonObjectionLetters[0];
  if (!letter) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const verdict = canStaffReviewNonObjectionLetter(letter);
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Compare-and-swap on `under_review`, the same pattern the payment routes
    // use: two admins opening the same letter would otherwise both decide it.
    const claimed = await prisma.nonObjectionLetter.updateMany({
      where: { id: letter.id, status: "under_review" },
      data: {
        status: parsed.data.status,
        reviewNote: parsed.data.reviewNote ?? null,
        reviewedAt: new Date(),
        reviewedByAdminId: session.user.id,
      },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "This letter was already reviewed by someone else. Reload and try again." },
        { status: 409 }
      );
    }
    const updated = await prisma.nonObjectionLetter.findUniqueOrThrow({ where: { id: letter.id } });

    await logAudit({
      actorUserId: session.user.id,
      action: "review_non_objection_letter",
      entityType: "non_objection_letter",
      entityId: letter.id,
      oldValue: letter,
      newValue: updated,
    });

    const approved = parsed.data.status === "approved";
    await createNotification({
      userId: order.clientId,
      type: "stage_status_changed",
      title: approved ? "تم اعتماد خطاب عدم الممانعة" : "خطاب عدم الممانعة يحتاج تعديلًا",
      message: approved
        ? "اعتمد فريقنا خطاب عدم الممانعة المرفوع على طلبك."
        : `لم يُقبل الخطاب المرفوع: ${parsed.data.reviewNote}. يمكنك رفع خطاب بديل من صفحة طلبك.`,
      orderId,
    }).catch(() => {});

    return NextResponse.json({ nonObjectionLetter: updated });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
