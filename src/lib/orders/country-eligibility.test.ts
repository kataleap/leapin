import { describe, it, expect } from "vitest";
import { isCountryEligibleFor, filterCountriesByNationality } from "./country-eligibility";
import { missingProfileFields, isProfileReadyForJourney } from "./journey-readiness";

const uae = {
  id: "uae",
  nationalityRestrictions: [
    { nationalityCode: "ISR", isEligible: false },
    { nationalityCode: "EGY", isEligible: true },
  ],
};
const uk = { id: "uk", nationalityRestrictions: [] };

describe("isCountryEligibleFor", () => {
  it("allows a nationality with no rule at all — rows are exceptions, not permits", () => {
    expect(isCountryEligibleFor(uae, "SAU")).toBe(true);
    expect(isCountryEligibleFor(uk, "SAU")).toBe(true);
  });

  it("bars a nationality with an explicit is_eligible = false rule", () => {
    expect(isCountryEligibleFor(uae, "ISR")).toBe(false);
  });

  it("honours an explicit is_eligible = true rule", () => {
    expect(isCountryEligibleFor(uae, "EGY")).toBe(true);
  });

  it("does not hide anything when no nationality is on file", () => {
    expect(isCountryEligibleFor(uae, null)).toBe(true);
    expect(isCountryEligibleFor(uae, undefined)).toBe(true);
  });
});

describe("filterCountriesByNationality", () => {
  it("removes only the barred countries", () => {
    expect(filterCountriesByNationality([uae, uk], "ISR").map((c) => c.id)).toEqual(["uk"]);
    expect(filterCountriesByNationality([uae, uk], "SAU").map((c) => c.id)).toEqual(["uae", "uk"]);
  });
});

describe("missingProfileFields", () => {
  it("names every field the journey depends on", () => {
    expect(missingProfileFields({})).toEqual(["nationality", "residencyStatus", "phone"]);
  });

  it("treats an empty string as missing, not as an answer", () => {
    expect(missingProfileFields({ nationality: "", residencyStatus: "", phone: "" })).toEqual([
      "nationality",
      "residencyStatus",
      "phone",
    ]);
  });

  it("is satisfied by a complete client record", () => {
    const user = { nationality: "SAU", residencyStatus: "resident", phone: "+966500000000" };
    expect(missingProfileFields(user)).toEqual([]);
    expect(isProfileReadyForJourney(user)).toBe(true);
  });

  it("reports the one field that is still missing", () => {
    expect(missingProfileFields({ nationality: "EGY", phone: "+201000000000" })).toEqual([
      "residencyStatus",
    ]);
  });
});
