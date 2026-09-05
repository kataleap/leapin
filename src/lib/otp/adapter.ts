// OTP Provider Adapter (Phase 5 doc §4.4) — mirrors the Payment Gateway
// Adapter (src/lib/payments/adapter.ts) and Email Provider Adapter
// (src/lib/email/adapter.ts): the rest of the app depends only on this
// interface, never on a specific SMS/WhatsApp vendor's SDK/API shape.
// Swapping the channel (SMS vs WhatsApp) or the provider within a channel
// later means writing a new implementation of this interface, nothing else
// changes.
//
// Smaller than the payment/email interfaces on purpose: OTP verification is
// a local DB comparison (see src/lib/otp/service.ts), not something a
// provider reports back via webhook, so there's no verifyWebhookSignature/
// parseWebhookEvent pair here.

export type OtpSendInput = {
  to: string;
  code: string;
};

export type OtpSendResult = {
  providerReference?: string;
};

export class OtpProviderError extends Error {}

export interface OtpAdapter {
  sendOtp(input: OtpSendInput): Promise<OtpSendResult>;
}
