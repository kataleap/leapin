// Doc §5.1, country_nationality_restrictions: "يتحكم بظهور/إخفاء الدولة كخيار
// حسب جنسية العميل". The table existed from the first migration and was never
// read by anything — every client saw every active country regardless of
// whether they could actually be incorporated there.

export type CountryWithRestrictions = {
  id: string;
  nationalityRestrictions: { nationalityCode: string; isEligible: boolean }[];
};

/**
 * Allow-by-default. A restriction table that had to enumerate all ~249
 * nationalities per country before that country could be offered would be
 * wrong far more often than it was right — the rows that get maintained are
 * the exceptions ("this nationality cannot incorporate here"), so absence of a
 * row means no known restriction, and only an explicit `is_eligible = false`
 * hides the country.
 */
export function isCountryEligibleFor(
  country: CountryWithRestrictions,
  nationalityCode: string | null | undefined
): boolean {
  // Without a nationality on file nothing can be judged. The journey requires
  // one before it starts, so this is the belt to that braces.
  if (!nationalityCode) return true;
  const rule = country.nationalityRestrictions.find((r) => r.nationalityCode === nationalityCode);
  return rule ? rule.isEligible : true;
}

export function filterCountriesByNationality<T extends CountryWithRestrictions>(
  countries: T[],
  nationalityCode: string | null | undefined
): T[] {
  return countries.filter((c) => isCountryEligibleFor(c, nationalityCode));
}
