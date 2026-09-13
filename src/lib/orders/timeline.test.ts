import { describe, it, expect } from "vitest";
import { buildOrderTimeline, type TimelineInput } from "./timeline";
import { formatOrderNumber } from "./order-number";

const at = (iso: string) => new Date(iso);

function input(overrides: Partial<TimelineInput> = {}): TimelineInput {
  return {
    createdAt: at("2026-01-01T10:00:00Z"),
    orderStages: [],
    orderPayments: [],
    documents: [],
    tradeNames: [],
    nonObjectionLetters: [],
    ...overrides,
  };
}

describe("buildOrderTimeline", () => {
  it("always opens with the order's own creation", () => {
    const events = buildOrderTimeline(input());
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("تم إنشاء الطلب");
  });

  it("returns events newest first", () => {
    const events = buildOrderTimeline(
      input({
        orderPayments: [
          { installmentNumber: 1, amount: 1000, dueAt: at("2026-01-02T10:00:00Z"), paidAt: at("2026-01-05T10:00:00Z") },
        ],
      })
    );
    expect(events.map((e) => e.at.toISOString())).toEqual([
      "2026-01-05T10:00:00.000Z",
      "2026-01-02T10:00:00.000Z",
      "2026-01-01T10:00:00.000Z",
    ]);
  });

  it("omits stages that are skipped for this order", () => {
    const events = buildOrderTimeline(
      input({
        orderStages: [
          {
            status: "skipped",
            startedAt: at("2026-01-02T10:00:00Z"),
            completedAt: at("2026-01-03T10:00:00Z"),
            stage: { nameAr: "مرحلة خارج النطاق" },
          },
        ],
      })
    );
    expect(events).toHaveLength(1);
  });

  it("records a stage's start and completion separately", () => {
    const events = buildOrderTimeline(
      input({
        orderStages: [
          {
            status: "completed",
            startedAt: at("2026-01-02T10:00:00Z"),
            completedAt: at("2026-01-04T10:00:00Z"),
            stage: { nameAr: "الترخيص" },
          },
        ],
      })
    );
    expect(events.map((e) => e.title)).toEqual([
      "اكتملت مرحلة «الترخيص»",
      "بدأت مرحلة «الترخيص»",
      "تم إنشاء الطلب",
    ]);
  });

  // The point of the timeline for a client is finding out what is holding
  // their order up — a stage waiting on them has no timestamp of its own and
  // would otherwise never appear.
  it("surfaces a stage that is currently waiting on someone", () => {
    const events = buildOrderTimeline(
      input({
        orderStages: [
          {
            status: "waiting_on_client",
            startedAt: at("2026-01-03T10:00:00Z"),
            completedAt: null,
            stage: { nameAr: "الأسماء التجارية" },
          },
        ],
      })
    );
    expect(events[0].title).toBe("مرحلة «الأسماء التجارية» بانتظارك");
  });

  it("does not re-announce a waiting stage once it has completed", () => {
    const events = buildOrderTimeline(
      input({
        orderStages: [
          {
            status: "completed",
            startedAt: at("2026-01-03T10:00:00Z"),
            completedAt: at("2026-01-06T10:00:00Z"),
            stage: { nameAr: "الأسماء التجارية" },
          },
        ],
      })
    );
    expect(events.filter((e) => e.title.includes("بانتظار"))).toHaveLength(0);
  });

  it("collapses one batch of trade names into a single event", () => {
    const events = buildOrderTimeline(
      input({
        tradeNames: [
          { batchNumber: 1, submittedAt: at("2026-01-02T10:00:00Z") },
          { batchNumber: 1, submittedAt: at("2026-01-02T10:00:00Z") },
          { batchNumber: 1, submittedAt: at("2026-01-02T10:00:00Z") },
          { batchNumber: 2, submittedAt: at("2026-01-09T10:00:00Z") },
        ],
      })
    );
    const batchEvents = events.filter((e) => e.kind === "trade_name");
    expect(batchEvents).toHaveLength(2);
    expect(batchEvents[0].title).toContain("2");
  });

  it("distinguishes a document the client uploaded from one the team added", () => {
    const events = buildOrderTimeline(
      input({
        documents: [
          { originalFileName: "iqama.pdf", uploadedAt: at("2026-01-03T10:00:00Z"), uploadedByClientId: "u1" },
          { originalFileName: "licence.pdf", uploadedAt: at("2026-01-04T10:00:00Z"), uploadedByClientId: null },
        ],
      })
    );
    expect(events[0].title).toBe("أضاف فريقنا مستندًا");
    expect(events[1].title).toBe("رفعتَ مستندًا");
  });

  it("records the letter's submission and its review outcome", () => {
    const events = buildOrderTimeline(
      input({
        nonObjectionLetters: [
          {
            status: "approved",
            submittedAt: at("2026-01-03T10:00:00Z"),
            reviewedAt: at("2026-01-05T10:00:00Z"),
          },
        ],
      })
    );
    expect(events.map((e) => e.title)).toEqual([
      "خطاب عدم الممانعة: معتمد",
      "رُفع خطاب عدم الممانعة",
      "تم إنشاء الطلب",
    ]);
  });

  it("shows nothing about a letter that was never submitted", () => {
    const events = buildOrderTimeline(
      input({ nonObjectionLetters: [{ status: "not_submitted", submittedAt: null, reviewedAt: null }] })
    );
    expect(events).toHaveLength(1);
  });
});

describe("formatOrderNumber", () => {
  it("pads to a stable width so numbers line up in a list", () => {
    expect(formatOrderNumber(1)).toBe("LP-00001");
    expect(formatOrderNumber(4321)).toBe("LP-04321");
  });

  it("does not truncate once the sequence outgrows the padding", () => {
    expect(formatOrderNumber(1234567)).toBe("LP-1234567");
  });
});
