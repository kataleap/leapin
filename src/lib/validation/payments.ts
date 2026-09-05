import { z } from "zod";

// Admin confirming a bank-transfer proof, or recording a cash collection.
export const confirmPaymentSchema = z.object({
  method: z.enum(["bank_transfer", "cash"]),
});

// Manual refund — the only transition this endpoint allows.
export const refundPaymentSchema = z.object({
  status: z.literal("refunded"),
});
