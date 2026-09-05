import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "@/lib/email";

// Deliberately unauthenticated in the session sense, same reasoning as
// src/app/api/webhooks/payments/route.ts — this is called by Postmark's
// servers, not a logged-in session; verifyWebhookSignature checks the Basic
// Auth credentials configured on the webhook URL instead (see postmark.ts).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const adapter = getEmailProvider();

  if (!adapter.verifyWebhookSignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event;
  try {
    event = adapter.parseWebhookEvent(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  // A delivery confirmation is a no-op — the row is already "sent"; only a
  // bounce/complaint changes anything (§7's status enum has no separate
  // "delivered" state).
  if (event.status === "delivered") {
    return NextResponse.json({ ok: true });
  }

  const log = await prisma.notificationLog.findFirst({ where: { providerReference: event.providerReference } });
  if (!log) {
    // Nothing we can or should do with an unrecognized reference — 200 so
    // Postmark doesn't retry forever over something we'll never match.
    return NextResponse.json({ ok: true });
  }

  await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "bounced" } });

  return NextResponse.json({ ok: true });
}
