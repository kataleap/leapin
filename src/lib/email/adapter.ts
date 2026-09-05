// Email Provider Adapter (Phase 4 doc §4.3) — mirrors the Payment Gateway
// Adapter pattern from src/lib/payments/adapter.ts: the rest of the app
// depends only on this interface, never on a specific provider's SDK/API
// shape. Swapping providers later means writing a new implementation of
// this interface, nothing else changes.

export type EmailSendInput = {
  to: string;
  subject: string;
  html: string;
};

export type EmailSendResult = {
  providerReference: string;
};

// Only "bounced" ever changes a notification_log row after the fact (§7's
// status enum has no separate "delivered" state — a delivery confirmation
// is a no-op against a row already recorded as "sent"). A spam complaint is
// treated the same as a bounce — one more reason not to trust that address.
export type EmailWebhookStatus = "delivered" | "bounced";

export type EmailWebhookEvent = {
  providerReference: string;
  status: EmailWebhookStatus;
};

export class EmailProviderError extends Error {}

export interface EmailAdapter {
  sendTransactionalEmail(input: EmailSendInput): Promise<EmailSendResult>;
  // rawBody must be the exact, unparsed request body, same reasoning as
  // PaymentGatewayAdapter.verifyWebhookSignature.
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
  parseWebhookEvent(rawBody: string): EmailWebhookEvent;
}
