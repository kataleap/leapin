import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { getEmailProvider, EmailProviderError } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// Manual resend (doc §6, §8) — replays the exact subject/bodyHtml already
// recorded on the failed row instead of re-deriving a message from the
// order's current (possibly since-changed) state. No new row is created;
// this row is updated in place, same as a payment's "sync status" action.
export async function POST(_request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  const { id } = await params;
  const log = await prisma.notificationLog.findUnique({ where: { id } });
  if (!log) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!(await canStaffAccessOrder(log.orderId, session))) {
    return NextResponse.json({ error: "This order is not assigned to you." }, { status: 403 });
  }

  if (log.status !== "failed") {
    return NextResponse.json({ error: "Only a failed notification can be resent." }, { status: 409 });
  }
  if (!log.subject || !log.bodyHtml) {
    return NextResponse.json({ error: "No stored content to resend." }, { status: 409 });
  }

  // Claim the row before sending anything. The status check above is against
  // a stale read, so two clicks on "resend" both passed it and both mailed
  // the client. `sentAt` already means "time of the last attempt", so bumping
  // it is both the claim and the correct bookkeeping; matching on the value
  // we read makes it an optimistic lock without needing a new enum state.
  const claimed = await prisma.notificationLog.updateMany({
    where: { id, status: "failed", sentAt: log.sentAt },
    data: { sentAt: new Date() },
  });
  if (claimed.count === 0) {
    return NextResponse.json(
      { error: "This notification is already being resent, or its status changed. Reload and try again." },
      { status: 409 }
    );
  }

  let updated;
  try {
    const result = await getEmailProvider().sendTransactionalEmail({
      to: log.recipientEmail,
      subject: log.subject,
      html: log.bodyHtml,
    });
    updated = await prisma.notificationLog.update({
      where: { id },
      data: { status: "sent", providerReference: result.providerReference, errorMessage: null, sentAt: new Date() },
    });
  } catch (err) {
    updated = await prisma.notificationLog.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: err instanceof EmailProviderError ? err.message : "Unexpected error while sending email.",
        sentAt: new Date(),
      },
    });
  }

  return NextResponse.json({ notificationLog: updated });
}
