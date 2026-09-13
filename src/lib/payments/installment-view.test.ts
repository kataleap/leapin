import { describe, it, expect } from "vitest";
import {
  INSTALLMENT_FILTERS,
  buildInstallmentWhere,
  isAwaitingManualReview,
  isPending,
  matchesInstallmentFilter,
  parseInstallmentFilter,
} from "./installment-view";

const transferAwaitingReview = {
  status: "pending",
  method: "bank_transfer",
  proofUploadedAt: new Date("2026-09-01"),
};
const transferNoProof = { status: "pending", method: "bank_transfer", proofUploadedAt: null };
const onlinePending = { status: "pending", method: "online", proofUploadedAt: null };
const untouched = { status: "pending", method: null, proofUploadedAt: null };
const settled = { status: "paid", method: "bank_transfer", proofUploadedAt: new Date("2026-09-01") };

describe("isAwaitingManualReview", () => {
  it("is true only for a pending bank transfer whose receipt has arrived", () => {
    expect(isAwaitingManualReview(transferAwaitingReview)).toBe(true);
  });

  it("is false for a bank transfer with no receipt yet", () => {
    expect(isAwaitingManualReview(transferNoProof)).toBe(false);
  });

  it("is false for a gateway payment", () => {
    expect(isAwaitingManualReview(onlinePending)).toBe(false);
  });

  it("is false once the payment is settled, receipt or not", () => {
    expect(isAwaitingManualReview(settled)).toBe(false);
  });
});

describe("isPending", () => {
  it("excludes installments already sitting in the review queue", () => {
    // Otherwise an awaiting-review transfer would be counted under two tabs.
    expect(isPending(transferAwaitingReview)).toBe(false);
    expect(isPending(transferNoProof)).toBe(true);
    expect(isPending(onlinePending)).toBe(true);
    expect(isPending(untouched)).toBe(true);
  });
});

describe("matchesInstallmentFilter", () => {
  it("puts every installment under 'all'", () => {
    for (const p of [transferAwaitingReview, onlinePending, settled, untouched]) {
      expect(matchesInstallmentFilter(p, "all")).toBe(true);
    }
  });

  it("sorts each installment into exactly one of the three real tabs", () => {
    const tabs = ["paid", "pending", "awaiting_review"] as const;
    for (const p of [transferAwaitingReview, transferNoProof, onlinePending, settled, untouched]) {
      const hits = tabs.filter((t) => matchesInstallmentFilter(p, t));
      expect(hits).toHaveLength(1);
    }
  });

  it("routes the review queue to awaiting_review and settled money to paid", () => {
    expect(matchesInstallmentFilter(transferAwaitingReview, "awaiting_review")).toBe(true);
    expect(matchesInstallmentFilter(settled, "paid")).toBe(true);
  });
});

describe("buildInstallmentWhere", () => {
  it("returns no predicate for 'all' so the query stays unfiltered", () => {
    expect(buildInstallmentWhere("all")).toBeUndefined();
  });

  it("filters paid by status alone", () => {
    expect(buildInstallmentWhere("paid")).toEqual({ status: "paid" });
  });

  it("excludes the review queue from pending, mirroring isPending", () => {
    expect(buildInstallmentWhere("pending")).toEqual({
      status: "pending",
      NOT: { method: "bank_transfer", proofUploadedAt: { not: null } },
    });
  });

  it("describes the review queue as a pending transfer with a receipt", () => {
    expect(buildInstallmentWhere("awaiting_review")).toEqual({
      status: "pending",
      method: "bank_transfer",
      proofUploadedAt: { not: null },
    });
  });
});

describe("parseInstallmentFilter", () => {
  it("accepts every known filter", () => {
    for (const f of INSTALLMENT_FILTERS) expect(parseInstallmentFilter(f)).toBe(f);
  });

  it("falls back to 'all' for anything a hand-edited query string may carry", () => {
    expect(parseInstallmentFilter(undefined)).toBe("all");
    expect(parseInstallmentFilter("refunded")).toBe("all");
    expect(parseInstallmentFilter("")).toBe("all");
  });

  it("takes the first value when the param is repeated", () => {
    expect(parseInstallmentFilter(["paid", "pending"])).toBe("paid");
  });
});
