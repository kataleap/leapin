import { describe, it, expect } from "vitest";
import {
  isNonObjectionLetterRequired,
  canClientSubmitNonObjectionLetter,
  canStaffReviewNonObjectionLetter,
} from "./non-objection";
import { NonObjectionLetterStatus } from "@/generated/prisma/enums";

describe("isNonObjectionLetterRequired", () => {
  it("requires it for a non-Saudi resident inside Saudi Arabia — the sponsor case", () => {
    expect(isNonObjectionLetterRequired({ residencyStatus: "resident", nationality: "EGY" })).toBe(true);
    expect(isNonObjectionLetterRequired({ residencyStatus: "resident", nationality: "IND" })).toBe(true);
  });

  it("does not require it from a Saudi national living in Saudi Arabia — there is no sponsor", () => {
    expect(isNonObjectionLetterRequired({ residencyStatus: "resident", nationality: "SAU" })).toBe(false);
  });

  it("does not require it from anyone outside Saudi Arabia, of any nationality", () => {
    expect(isNonObjectionLetterRequired({ residencyStatus: "non_resident", nationality: "EGY" })).toBe(false);
    expect(isNonObjectionLetterRequired({ residencyStatus: "non_resident", nationality: "SAU" })).toBe(false);
  });

  it("does not require it when residency is unknown — never invent an obligation", () => {
    expect(isNonObjectionLetterRequired({ nationality: "EGY" })).toBe(false);
    expect(isNonObjectionLetterRequired({ residencyStatus: null, nationality: "EGY" })).toBe(false);
  });
});

describe("canClientSubmitNonObjectionLetter", () => {
  const letter = (status: NonObjectionLetterStatus, isRequired = true) => ({ isRequired, status });

  it("lets the client upload when nothing has been submitted", () => {
    expect(canClientSubmitNonObjectionLetter(letter(NonObjectionLetterStatus.not_submitted)).allowed).toBe(
      true
    );
  });

  it("lets the client replace a rejected letter", () => {
    expect(canClientSubmitNonObjectionLetter(letter(NonObjectionLetterStatus.rejected)).allowed).toBe(true);
  });

  it("refuses a second upload while the first is under review", () => {
    expect(canClientSubmitNonObjectionLetter(letter(NonObjectionLetterStatus.under_review)).allowed).toBe(
      false
    );
  });

  it("refuses re-uploading over an approved letter", () => {
    expect(canClientSubmitNonObjectionLetter(letter(NonObjectionLetterStatus.approved)).allowed).toBe(false);
  });

  it("refuses entirely when the order never required one", () => {
    const verdict = canClientSubmitNonObjectionLetter(
      letter(NonObjectionLetterStatus.not_submitted, false)
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.reason).toMatch("لا يتطلب");
  });
});

describe("canStaffReviewNonObjectionLetter", () => {
  const letter = (status: NonObjectionLetterStatus, isRequired = true) => ({ isRequired, status });

  it("allows reviewing exactly what is awaiting review", () => {
    expect(canStaffReviewNonObjectionLetter(letter(NonObjectionLetterStatus.under_review)).allowed).toBe(
      true
    );
  });

  it.each([
    NonObjectionLetterStatus.not_submitted,
    NonObjectionLetterStatus.approved,
    NonObjectionLetterStatus.rejected,
  ])("refuses to review a letter that is %s", (status) => {
    expect(canStaffReviewNonObjectionLetter(letter(status)).allowed).toBe(false);
  });

  it("refuses on an order with no requirement", () => {
    expect(
      canStaffReviewNonObjectionLetter(letter(NonObjectionLetterStatus.under_review, false)).allowed
    ).toBe(false);
  });
});
