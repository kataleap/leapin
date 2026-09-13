import { describe, it, expect } from "vitest";
import {
  canClientUploadDocuments,
  canClientSubmitTradeNames,
  stagesWaitingOnClient,
  CLIENT_UPLOADABLE_DOCUMENT_TYPES,
} from "./client-actions";
import { DocumentType, OrderStatus, OrderStageStatus, TradeNameStatus } from "@/generated/prisma/enums";

describe("canClientUploadDocuments", () => {
  it.each([OrderStatus.draft, OrderStatus.pending_payment, OrderStatus.in_progress, OrderStatus.on_hold])(
    "allows uploading while the order is %s",
    (status) => {
      expect(canClientUploadDocuments(status).allowed).toBe(true);
    }
  );

  it.each([OrderStatus.completed, OrderStatus.cancelled])("refuses once the order is %s", (status) => {
    expect(canClientUploadDocuments(status).allowed).toBe(false);
  });

  it("never lets a client upload an admin-issued deliverable", () => {
    const uploadable: string[] = [...CLIENT_UPLOADABLE_DOCUMENT_TYPES];
    expect(uploadable).not.toContain(DocumentType.misa_license);
    expect(uploadable).not.toContain(DocumentType.commercial_register);
    expect(uploadable).not.toContain(DocumentType.incorporation_contract);
  });
});

describe("canClientSubmitTradeNames", () => {
  const name = (status: TradeNameStatus, batchNumber = 1) => ({ status, batchNumber });

  it("allows a first submission on an active order with no names yet", () => {
    expect(canClientSubmitTradeNames(OrderStatus.in_progress, []).allowed).toBe(true);
  });

  it.each([TradeNameStatus.submitted, TradeNameStatus.under_review])(
    "refuses a second batch while the latest one is %s",
    (status) => {
      const verdict = canClientSubmitTradeNames(OrderStatus.in_progress, [name(status)]);
      expect(verdict.allowed).toBe(false);
      expect(verdict.allowed === false && verdict.reason).toMatch("قيد المراجعة");
    }
  );

  it("allows a fresh batch once every name in the latest batch was rejected", () => {
    expect(
      canClientSubmitTradeNames(OrderStatus.in_progress, [
        name(TradeNameStatus.rejected),
        name(TradeNameStatus.rejected),
      ]).allowed
    ).toBe(true);
  });

  it("judges only the latest batch, not settled history", () => {
    expect(
      canClientSubmitTradeNames(OrderStatus.in_progress, [
        name(TradeNameStatus.rejected, 1),
        name(TradeNameStatus.rejected, 2),
      ]).allowed
    ).toBe(true);
  });

  it("refuses once any name has been approved, in any batch", () => {
    const verdict = canClientSubmitTradeNames(OrderStatus.in_progress, [
      name(TradeNameStatus.approved, 1),
      name(TradeNameStatus.rejected, 2),
    ]);
    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.reason).toMatch("اعتماد");
  });

  it.each([OrderStatus.completed, OrderStatus.cancelled])("refuses on a %s order", (status) => {
    expect(canClientSubmitTradeNames(status, []).allowed).toBe(false);
  });
});

describe("stagesWaitingOnClient", () => {
  it("picks out only the stages actually waiting on the client", () => {
    const stages = [
      { id: "a", status: OrderStageStatus.completed },
      { id: "b", status: OrderStageStatus.waiting_on_client },
      { id: "c", status: OrderStageStatus.waiting_on_government },
      { id: "d", status: OrderStageStatus.waiting_on_client },
    ];
    expect(stagesWaitingOnClient(stages).map((s) => s.id)).toEqual(["b", "d"]);
  });
});
