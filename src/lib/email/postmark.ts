import { EmailProviderError, type EmailAdapter, type EmailSendInput, type EmailSendResult, type EmailWebhookEvent } from "./adapter";
import { env } from "@/lib/env";

// Postmark REST integration — hand-rolled via fetch (no SDK is published/
// installed; same call as src/lib/payments/moyasar.ts for the same reason:
// this is a small server-to-server surface).
//
// ⚠️ VERIFY AGAINST LIVE POSTMARK DOCS BEFORE RELYING ON THIS IN PRODUCTION.
// The request/response field names and the webhook auth mechanism below are
// best-effort assumptions from documentation memory, not confirmed against a
// live account this session. This file is the ONLY place that needs
// correcting if any of them are wrong — see adapter.ts.
//
// Postmark has no payload-signature scheme like Moyasar's secret_token; its
// documented mechanism is HTTP Basic Auth configured directly on the
// webhook URL registered in the Postmark dashboard. verifyWebhookSignature
// below checks that Authorization header against our own expected
// credentials instead of a signature over the body.

const POSTMARK_BASE_URL = env.POSTMARK_BASE_URL;

function serverToken(): string {
  const token = env.POSTMARK_SERVER_TOKEN;
  if (!token) throw new EmailProviderError("POSTMARK_SERVER_TOKEN is not configured.");
  return token;
}

function fromAddress(): string {
  const from = env.POSTMARK_FROM_EMAIL;
  if (!from) throw new EmailProviderError("POSTMARK_FROM_EMAIL is not configured.");
  return from;
}

// Constant-time compare to avoid a timing side-channel on the credentials —
// same approach as moyasar.ts:verifyWebhookSignature.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendTransactionalEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const res = await fetch(`${POSTMARK_BASE_URL}/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Postmark-Server-Token": serverToken(),
    },
    body: JSON.stringify({
      From: fromAddress(),
      To: input.to,
      Subject: input.subject,
      HtmlBody: input.html,
      MessageStream: "outbound",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new EmailProviderError(`Postmark request failed (${res.status}): ${JSON.stringify(body)}`);
  }
  const messageId = (body as { MessageID?: string } | null)?.MessageID;
  if (!messageId) throw new EmailProviderError("Postmark response missing MessageID.");
  return { providerReference: messageId };
}

function verifyWebhookSignature(_rawBody: string, headers: Headers): boolean {
  const expectedUser = env.POSTMARK_WEBHOOK_USERNAME;
  const expectedPass = env.POSTMARK_WEBHOOK_PASSWORD;
  if (!expectedUser || !expectedPass) return false;

  const authHeader = headers.get("authorization") ?? "";
  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return false;
  }
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;
  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);

  return timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass);
}

// Postmark posts one event object per webhook call (not a batch) — one of
// RecordType: "Delivery" | "Bounce" | "SpamComplaint".
function parseWebhookEvent(rawBody: string): EmailWebhookEvent {
  const payload = JSON.parse(rawBody) as { RecordType: string; MessageID: string };
  const status = payload.RecordType === "Delivery" ? "delivered" : "bounced";
  return { providerReference: payload.MessageID, status };
}

export const postmarkAdapter: EmailAdapter = {
  sendTransactionalEmail,
  verifyWebhookSignature,
  parseWebhookEvent,
};
