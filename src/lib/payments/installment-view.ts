import type { Prisma } from "@/generated/prisma/client";

// Phase 6 §5.3 — the three payment states the accounting screen filters by.
//
// Two of them are columns; the third is not. "Awaiting manual review" is a
// bank transfer whose proof has arrived but which nobody has confirmed yet,
// and it is derived rather than stored: adding a fourth PaymentStatus would
// have meant a second source of truth for "is this installment settled",
// which the gateway webhook and the confirm route both already answer from
// `status` alone.
//
// Kept free of server-only imports so client components may use the
// predicate, following the convention in src/lib/orders/status-labels.ts.

export const INSTALLMENT_FILTERS = ["all", "paid", "pending", "awaiting_review"] as const;
export type InstallmentFilter = (typeof INSTALLMENT_FILTERS)[number];

export const INSTALLMENT_FILTER_LABEL: Record<InstallmentFilter, string> = {
  all: "الكل",
  paid: "مدفوع",
  pending: "معلّق",
  awaiting_review: "بانتظار مراجعة يدوية",
};

export function parseInstallmentFilter(raw: string | string[] | undefined): InstallmentFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return INSTALLMENT_FILTERS.includes(value as InstallmentFilter)
    ? (value as InstallmentFilter)
    : "all";
}

type InstallmentShape = {
  status: string;
  method: string | null;
  proofUploadedAt: Date | null;
};

/** The client has paid by transfer and uploaded the receipt; a human must now confirm it. */
export function isAwaitingManualReview(p: InstallmentShape): boolean {
  return p.method === "bank_transfer" && p.proofUploadedAt != null && p.status === "pending";
}

/**
 * "Pending" on this screen means still owed and not already sitting in the
 * review queue — otherwise every awaiting-review installment would show up
 * under two different filters and be counted twice.
 */
export function isPending(p: InstallmentShape): boolean {
  return p.status === "pending" && !isAwaitingManualReview(p);
}

export function matchesInstallmentFilter(p: InstallmentShape, filter: InstallmentFilter): boolean {
  switch (filter) {
    case "paid":
      return p.status === "paid";
    case "pending":
      return isPending(p);
    case "awaiting_review":
      return isAwaitingManualReview(p);
    case "all":
      return true;
  }
}

/**
 * The same rule as a Prisma predicate, for `orders.where.orderPayments.some`.
 * Must stay in step with matchesInstallmentFilter above — the screen filters
 * orders with this, then highlights the matching installments with that.
 */
export function buildInstallmentWhere(
  filter: InstallmentFilter
): Prisma.OrderPaymentWhereInput | undefined {
  switch (filter) {
    case "paid":
      return { status: "paid" };
    case "pending":
      return {
        status: "pending",
        NOT: { method: "bank_transfer", proofUploadedAt: { not: null } },
      };
    case "awaiting_review":
      return { status: "pending", method: "bank_transfer", proofUploadedAt: { not: null } };
    case "all":
      return undefined;
  }
}
