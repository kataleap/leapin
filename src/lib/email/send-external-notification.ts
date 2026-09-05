import { prisma } from "@/lib/prisma";
import { getEmailProvider, EmailProviderError } from "@/lib/email";
import { buildNotificationEmail } from "./templates";
import type { NotificationLogEventType } from "@/generated/prisma/enums";

// Shared by every trigger point (doc §5) — builds the email, sends it, and
// records the attempt in notification_log (§7) whatever the outcome. Never
// throws: a failed email must never fail the stage/payment update that
// triggered it (§6 — no queue, no automatic retry; a failure just sits in
// notification_log until an admin clicks "resend").
export async function sendExternalNotification(params: {
  orderId: string;
  recipientEmail: string;
  eventType: NotificationLogEventType;
  title: string;
  message: string;
  link: string;
}): Promise<void> {
  const { orderId, recipientEmail, eventType, title, message, link } = params;
  const { subject, html } = buildNotificationEmail({ title, message, link });

  // Only the send itself is in this try. Logging the outcome is deliberately
  // outside it: when the log write sat inside, a DB error *after* a
  // successful send fell into the catch and recorded "failed" for an email
  // the client had already received — and the admin's resend button then
  // mailed them a second copy.
  let result: { providerReference?: string } | null = null;
  let errorMessage: string | null = null;
  try {
    result = await getEmailProvider().sendTransactionalEmail({ to: recipientEmail, subject, html });
  } catch (err) {
    errorMessage = err instanceof EmailProviderError ? err.message : "Unexpected error while sending email.";
  }

  // "Never throws" is a contract every caller relies on — a stage update or
  // an order creation must not be undone by a bookkeeping failure. That means
  // the log write needs its own guard too, or it becomes the thing that
  // throws. Losing the log row is bad; losing the client's committed order
  // because we couldn't record an email is worse.
  try {
    await prisma.notificationLog.create({
      data: {
        orderId,
        channel: "email",
        eventType,
        recipientEmail,
        status: errorMessage === null ? "sent" : "failed",
        providerReference: result?.providerReference,
        errorMessage,
        subject,
        bodyHtml: html,
      },
    });
  } catch (logErr) {
    console.error("[notification] failed to record delivery attempt", {
      orderId,
      eventType,
      recipientEmail,
      sendFailed: errorMessage !== null,
      logErr,
    });
  }
}
