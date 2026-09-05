import {
  PaymentGatewayError,
  type PaymentGatewayAdapter,
  type PaymentGatewayCheckoutInput,
  type PaymentGatewayCheckoutResult,
  type PaymentGatewayStatus,
  type PaymentGatewayStatusResult,
} from "./adapter";
import { env } from "@/lib/env";

// Moyasar REST integration — hand-rolled via fetch (no SDK is published/
// installed; this is a small server-to-server surface).
//
// ⚠️ VERIFY AGAINST LIVE MOYASAR DOCS BEFORE RELYING ON THIS IN PRODUCTION.
// The request/response field names, the Invoice-vs-Payment resource choice,
// the auth header convention, and the webhook payload/signature shape below
// are all best-effort assumptions from documentation memory, not confirmed
// against a live Sandbox account this session. This file is the ONLY place
// that needs correcting if any of them are wrong — see adapter.ts.

const MOYASAR_BASE_URL = env.MOYASAR_BASE_URL;

function authHeader(): string {
  const secretKey = env.MOYASAR_SECRET_KEY;
  if (!secretKey) throw new PaymentGatewayError("MOYASAR_SECRET_KEY is not configured.");
  // Moyasar's documented convention: HTTP Basic Auth, secret key as
  // username, empty password.
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

async function moyasarFetch(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${MOYASAR_BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: authHeader(), "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new PaymentGatewayError(`Moyasar request failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

// Maps Moyasar's richer status vocabulary onto our three-value model.
function mapStatus(moyasarStatus: string): PaymentGatewayStatus {
  if (moyasarStatus === "paid") return "paid";
  if (moyasarStatus === "failed" || moyasarStatus === "expired" || moyasarStatus === "voided") return "failed";
  return "pending";
}

async function createCheckout(input: PaymentGatewayCheckoutInput): Promise<PaymentGatewayCheckoutResult> {
  const body = (await moyasarFetch("/invoices", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(input.amount * 100), // halalas
      currency: "SAR",
      description: input.description,
      success_url: input.successUrl,
      back_url: input.backUrl,
      metadata: { orderPaymentId: input.orderPaymentId },
    }),
  })) as { id: string; url: string };

  return { checkoutUrl: body.url, gatewayReference: body.id };
}

function verifyWebhookSignature(rawBody: string, _headers: Headers): boolean {
  const expected = env.MOYASAR_WEBHOOK_SECRET;
  if (!expected) return false;
  let payload: { secret_token?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const actual = payload.secret_token;
  if (!actual || actual.length !== expected.length) return false;
  // Constant-time compare to avoid a timing side-channel on the secret.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function parseWebhookEvent(rawBody: string): PaymentGatewayStatusResult {
  const payload = JSON.parse(rawBody) as {
    data: { id: string; status: string; updated_at?: string };
  };
  return {
    gatewayReference: payload.data.id,
    status: mapStatus(payload.data.status),
    paidAt: payload.data.status === "paid" ? new Date(payload.data.updated_at ?? Date.now()) : undefined,
  };
}

async function getPaymentStatus(gatewayReference: string): Promise<PaymentGatewayStatusResult> {
  const body = (await moyasarFetch(`/invoices/${gatewayReference}`, { method: "GET" })) as {
    id: string;
    status: string;
    updated_at?: string;
  };
  return {
    gatewayReference: body.id,
    status: mapStatus(body.status),
    paidAt: body.status === "paid" ? new Date(body.updated_at ?? Date.now()) : undefined,
  };
}

export const moyasarAdapter: PaymentGatewayAdapter = {
  createCheckout,
  verifyWebhookSignature,
  parseWebhookEvent,
  getPaymentStatus,
};
