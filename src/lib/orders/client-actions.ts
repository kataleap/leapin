import { DocumentType, OrderStatus, OrderStageStatus, TradeNameStatus } from "@/generated/prisma/enums";

// What a client is allowed to *do* on their own order, as pure predicates.
//
// The gap this closes: `waiting_on_client` was a status an admin could set —
// and an email the client received — with no corresponding action anywhere in
// the client UI. The client was told the ball was in their court and handed no
// way to play it.

// Phase-2 scope §4.2 names the client-supplied documents explicitly: attested
// foreign-company papers and financial statements. `other` is included because
// a stage can legitimately ask for something the enum doesn't enumerate.
// Everything else in DocumentType is an admin-issued deliverable (a MISA
// licence, a commercial register, an incorporation contract) — the client
// receives those, never submits them, and letting them upload one would put a
// self-declared "licence" in the vault next to the real one.
export const CLIENT_UPLOADABLE_DOCUMENT_TYPES = [
  DocumentType.foreign_company_docs,
  DocumentType.financial_statements,
  DocumentType.other,
] as const;

export const CLIENT_DOCUMENT_TYPE_LABEL: Record<(typeof CLIENT_UPLOADABLE_DOCUMENT_TYPES)[number], string> = {
  foreign_company_docs: "مستندات الشركة الأجنبية",
  financial_statements: "القوائم المالية",
  other: "أخرى",
};

// An order that is over, or that was called off, takes no further client
// input. `on_hold` deliberately still accepts it: a hold is often exactly the
// state an order sits in *because* something is missing from the client.
const CLOSED_STATUSES: OrderStatus[] = [OrderStatus.cancelled, OrderStatus.completed];

export type ClientActionVerdict = { allowed: true } | { allowed: false; reason: string };

export function canClientUploadDocuments(orderStatus: OrderStatus): ClientActionVerdict {
  if (CLOSED_STATUSES.includes(orderStatus)) {
    return { allowed: false, reason: "لا يمكن إضافة مستندات إلى طلب مكتمل أو ملغى." };
  }
  return { allowed: true };
}

export function canClientSubmitTradeNames(
  orderStatus: OrderStatus,
  tradeNames: { status: TradeNameStatus; batchNumber: number }[]
): ClientActionVerdict {
  if (CLOSED_STATUSES.includes(orderStatus)) {
    return { allowed: false, reason: "لا يمكن تقديم أسماء تجارية على طلب مكتمل أو ملغى." };
  }

  if (tradeNames.some((n) => n.status === TradeNameStatus.approved)) {
    return { allowed: false, reason: "تم اعتماد اسم تجاري لهذا الطلب بالفعل." };
  }

  // Only the newest batch decides: earlier batches are settled history. A
  // client whose five names were all rejected may submit a fresh batch; one
  // still awaiting the registry's answer may not stack another on top of it.
  const latestBatchNumber = tradeNames.reduce((max, n) => Math.max(max, n.batchNumber), 0);
  const pendingInLatestBatch = tradeNames.some(
    (n) =>
      n.batchNumber === latestBatchNumber &&
      (n.status === TradeNameStatus.submitted || n.status === TradeNameStatus.under_review)
  );
  if (pendingInLatestBatch) {
    return { allowed: false, reason: "لديك دفعة أسماء قيد المراجعة — انتظر نتيجتها قبل تقديم دفعة جديدة." };
  }

  return { allowed: true };
}

// Which stages are actually waiting on this client right now — what the order
// page needs in order to say "المطلوب منك" instead of leaving them to guess.
export function stagesWaitingOnClient<T extends { status: OrderStageStatus }>(stages: T[]): T[] {
  return stages.filter((s) => s.status === OrderStageStatus.waiting_on_client);
}
