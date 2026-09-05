import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payments";
import { applyPaymentStatusTransition } from "@/lib/payments/apply-status-transition";
import { getSystemUserId } from "@/lib/system-user";

// Deliberately unauthenticated (mirrors the one existing precedent,
// src/app/api/auth/register/route.ts: trust nothing from the caller,
// validate everything explicitly) — this is called by Moyasar's servers,
// not a logged-in session. src/proxy.ts's `authorized` callback only gates
// /admin and /superadmin *page* prefixes, so no change is needed there.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const adapter = getPaymentGateway();

  if (!adapter.verifyWebhookSignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event;
  try {
    event = adapter.parseWebhookEvent(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  const payment = await prisma.orderPayment.findUnique({ where: { gatewayReference: event.gatewayReference } });
  if (!payment) {
    // Nothing we can or should do with an unrecognized reference — 200 so
    // the gateway doesn't retry forever over something we'll never match.
    return NextResponse.json({ ok: true });
  }

  // A genuine unexpected error here (DB hiccup) should propagate as a 500
  // and rely on Moyasar's own webhook-delivery retries — no Redis/queue
  // this phase (see the plan's decision on this).
  await applyPaymentStatusTransition(payment.id, event, await getSystemUserId());

  return NextResponse.json({ ok: true });
}
