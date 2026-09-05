// Payment Gateway Adapter (Phase 3 doc §3.3) — the rest of the app depends
// only on this interface, never on a specific provider's SDK/API shape.
// Swapping providers later means writing a new implementation of this
// interface, nothing else changes.

export type PaymentGatewayCheckoutInput = {
  orderPaymentId: string;
  amount: number; // SAR, major units (e.g. 1500.00)
  description: string; // Arabic description shown on the hosted page
  successUrl: string; // absolute URL
  backUrl: string; // absolute URL
};

export type PaymentGatewayCheckoutResult = {
  checkoutUrl: string;
  gatewayReference: string;
};

export type PaymentGatewayStatus = "pending" | "paid" | "failed";

export type PaymentGatewayStatusResult = {
  gatewayReference: string;
  status: PaymentGatewayStatus;
  paidAt?: Date;
  // What the gateway says was actually paid. Optional because not every
  // provider reports it on every event shape — but when a provider does
  // report it, applyPaymentStatusTransition refuses to mark an installment
  // paid unless it matches the amount we billed. Without this the system
  // trusts a reference-to-status match alone, and a partial or
  // wrong-currency settlement marks the installment paid in full.
  //
  // ⚠️ Moyasar's implementation does not populate these yet — the field
  // names come from the same unverified guesswork flagged at the top of
  // moyasar.ts, and must be filled in during live sandbox verification.
  amount?: number; // SAR, major units — same convention as PaymentGatewayCheckoutInput
  currency?: string; // ISO 4217, e.g. "SAR"
};

export class PaymentGatewayError extends Error {}

export interface PaymentGatewayAdapter {
  createCheckout(input: PaymentGatewayCheckoutInput): Promise<PaymentGatewayCheckoutResult>;
  // rawBody must be the exact, unparsed request body — signature schemes
  // typically depend on the exact byte sequence, not a re-serialized object.
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
  parseWebhookEvent(rawBody: string): PaymentGatewayStatusResult;
  getPaymentStatus(gatewayReference: string): Promise<PaymentGatewayStatusResult>;
}
