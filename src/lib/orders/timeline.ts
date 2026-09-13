import { STAGE_STATUS_LABEL } from "@/lib/orders/stage-labels";
import { NOL_STATUS_LABEL } from "@/lib/orders/non-objection";
import type { NonObjectionLetterStatus, OrderStageStatus } from "@/generated/prisma/enums";

// The order's history, derived from the rows the order already has rather than
// written to a new event table. Two reasons: nothing can drift out of sync with
// the facts (there is only one copy of each), and every order that existed
// before this feature gets a full history for free instead of starting blank.
//
// The trade-off is deliberate and worth naming: only transitions that left a
// timestamp behind can appear. A stage that went in_progress → blocked →
// in_progress shows its start, not the round trip. Recording every transition
// needs an append-only event table, which is a bigger change than this is.

export type TimelineEvent = {
  at: Date;
  title: string;
  detail?: string;
  kind: "order" | "stage" | "payment" | "document" | "trade_name" | "letter";
  // An ongoing state ("waiting on you") borrows the timestamp of whatever
  // started it, so it ties with that start event. It is the more current of
  // the two, so it wins the tie and sits above it.
  ongoing?: boolean;
};

export type TimelineInput = {
  createdAt: Date;
  orderStages: {
    status: OrderStageStatus;
    startedAt: Date | null;
    completedAt: Date | null;
    stage: { nameAr: string };
  }[];
  orderPayments: {
    installmentNumber: number;
    amount: unknown;
    dueAt: Date | null;
    paidAt: Date | null;
  }[];
  documents: { originalFileName: string; uploadedAt: Date; uploadedByClientId: string | null }[];
  tradeNames: { batchNumber: number; submittedAt: Date }[];
  nonObjectionLetters: {
    status: NonObjectionLetterStatus;
    submittedAt: Date | null;
    reviewedAt: Date | null;
  }[];
};

function riyal(amount: unknown): string {
  return `${Number(amount).toLocaleString("ar-SA")} ريال`;
}

export function buildOrderTimeline(order: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [{ at: order.createdAt, title: "تم إنشاء الطلب", kind: "order" }];

  for (const os of order.orderStages) {
    if (os.status === "skipped") continue;
    if (os.startedAt) {
      events.push({ at: os.startedAt, title: `بدأت مرحلة «${os.stage.nameAr}»`, kind: "stage" });
    }
    if (os.completedAt) {
      events.push({ at: os.completedAt, title: `اكتملت مرحلة «${os.stage.nameAr}»`, kind: "stage" });
    }
    // A stage that is waiting on someone right now has no timestamp of its
    // own, so it would otherwise be invisible on the very timeline a client
    // consults to find out what is holding their order up.
    if (!os.completedAt && (os.status === "waiting_on_client" || os.status === "waiting_on_government")) {
      const at = os.startedAt ?? order.createdAt;
      events.push({
        at,
        title: `مرحلة «${os.stage.nameAr}» ${STAGE_STATUS_LABEL[os.status]}`,
        kind: "stage",
        ongoing: true,
      });
    }
  }

  for (const p of order.orderPayments) {
    if (p.dueAt) {
      events.push({
        at: p.dueAt,
        title: `استُحقت الدفعة ${p.installmentNumber}`,
        detail: riyal(p.amount),
        kind: "payment",
      });
    }
    if (p.paidAt) {
      events.push({
        at: p.paidAt,
        title: `سُدّدت الدفعة ${p.installmentNumber}`,
        detail: riyal(p.amount),
        kind: "payment",
      });
    }
  }

  for (const doc of order.documents) {
    events.push({
      at: doc.uploadedAt,
      title: doc.uploadedByClientId ? "رفعتَ مستندًا" : "أضاف فريقنا مستندًا",
      detail: doc.originalFileName,
      kind: "document",
    });
  }

  // One event per batch, not per name: five names submitted together are one
  // thing that happened.
  const batches = new Map<number, Date>();
  for (const name of order.tradeNames) {
    const existing = batches.get(name.batchNumber);
    if (!existing || name.submittedAt < existing) batches.set(name.batchNumber, name.submittedAt);
  }
  for (const [batchNumber, at] of batches) {
    events.push({ at, title: `تقديم دفعة الأسماء التجارية رقم ${batchNumber}`, kind: "trade_name" });
  }

  for (const letter of order.nonObjectionLetters) {
    if (letter.submittedAt) {
      events.push({ at: letter.submittedAt, title: "رُفع خطاب عدم الممانعة", kind: "letter" });
    }
    if (letter.reviewedAt) {
      events.push({
        at: letter.reviewedAt,
        title: `خطاب عدم الممانعة: ${NOL_STATUS_LABEL[letter.status]}`,
        kind: "letter",
      });
    }
  }

  // Newest first — the client's question is almost always "what happened
  // last", not "what happened first".
  return events.sort((a, b) => {
    const byTime = b.at.getTime() - a.at.getTime();
    if (byTime !== 0) return byTime;
    return Number(b.ongoing ?? false) - Number(a.ongoing ?? false);
  });
}
