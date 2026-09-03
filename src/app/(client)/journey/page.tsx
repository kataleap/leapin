"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

// Categories (and therefore Stage-3 activity selection) are only ever
// seeded against the regular-investment track (architecture doc §5.1) — the
// entrepreneurship track skips both steps entirely.
const CATEGORY_ELIGIBLE_TRACK_CODE = "regular_investment";

type Track = { id: string; code: string; nameAr: string; description: string | null };
type ActivityCategory = { id: string; code: string; nameAr: string };
type Activity = { id: string; nameAr: string; misaActivityCode: string };
type Package = {
  id: string;
  nameAr: string;
  description: string | null;
  totalPriceOverride: string | null;
  requiresCountry: boolean;
};
type Country = { id: string; nameAr: string; nameEn: string; basePrice: string };
type EstimateResult = {
  breakdown: { stageId: string; nameAr: string; price: number }[];
  total: number;
};

async function getJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T | null; error?: string }> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, data: null, error: data?.error ?? "Something went wrong." };
  return { ok: true, data };
}

export default function JourneyPage() {
  const router = useRouter();

  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);

  const [categories, setCategories] = useState<ActivityCategory[] | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [addableCategory, setAddableCategory] = useState<ActivityCategory | null>(null);
  const [addableActivities, setAddableActivities] = useState<Activity[] | null>(null);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);

  const [packages, setPackages] = useState<Package[] | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);

  const [countries, setCountries] = useState<Country[] | null>(null);
  const [countryId, setCountryId] = useState<string | null>(null);

  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedTrack = tracks?.find((t) => t.id === trackId) ?? null;
  const categoryEligible = selectedTrack?.code === CATEGORY_ELIGIBLE_TRACK_CODE;
  const selectedPackage = packages?.find((p) => p.id === packageId) ?? null;
  const packageStepReady = !!trackId && (!categoryEligible || !!categoryId);
  const selectionComplete =
    packageStepReady && !!packageId && (!selectedPackage?.requiresCountry || !!countryId);
  const estimating = selectionComplete && !estimate && !estimateError;

  // Load tracks once.
  useEffect(() => {
    getJson<{ tracks: Track[] }>("/api/journey/tracks").then(({ data }) => {
      if (data) setTracks(data.tracks);
    });
  }, []);

  // Load categories whenever a category-eligible track is selected.
  useEffect(() => {
    if (!trackId || !categoryEligible) return;
    let ignore = false;
    getJson<{ categories: ActivityCategory[] }>(`/api/journey/categories?track=${trackId}`).then(({ data }) => {
      if (!ignore && data) setCategories(data.categories);
    });
    return () => {
      ignore = true;
    };
  }, [trackId, categoryEligible]);

  // Load activities (primary + addable-via-mixing-rule) whenever the category changes.
  useEffect(() => {
    if (!categoryId) return;
    let ignore = false;
    getJson<{ activities: Activity[] }>(`/api/journey/activities?category=${categoryId}`).then(({ data }) => {
      if (!ignore && data) setActivities(data.activities);
    });
    getJson<{ addableCategories: ActivityCategory[] }>(`/api/journey/activity-mixing?category=${categoryId}`).then(
      ({ data }) => {
        if (ignore || !data) return;
        const addable = data.addableCategories[0] ?? null;
        setAddableCategory(addable);
        if (addable) {
          getJson<{ activities: Activity[] }>(`/api/journey/activities?category=${addable.id}`).then(
            ({ data: addableData }) => {
              if (!ignore && addableData) setAddableActivities(addableData.activities);
            }
          );
        }
      }
    );
    return () => {
      ignore = true;
    };
  }, [categoryId]);

  // Load packages whenever the selected track changes.
  useEffect(() => {
    if (!trackId) return;
    let ignore = false;
    getJson<{ packages: Package[] }>(`/api/journey/packages?track=${trackId}`).then(({ data }) => {
      if (!ignore && data) setPackages(data.packages);
    });
    return () => {
      ignore = true;
    };
  }, [trackId]);

  // Load the country list, once, the first time a country-requiring package is picked.
  useEffect(() => {
    if (selectedPackage?.requiresCountry && !countries) {
      getJson<{ countries: Country[] }>("/api/journey/countries").then(({ data }) => {
        if (data) setCountries(data.countries);
      });
    }
  }, [selectedPackage, countries]);

  // Fetch a live estimate whenever the selection is complete.
  useEffect(() => {
    if (!selectionComplete) return;
    let ignore = false;
    getJson<EstimateResult>("/api/journey/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId, packageId, countryId }),
    }).then(({ ok, data, error }) => {
      if (ignore) return;
      if (ok && data) setEstimate(data);
      else setEstimateError(error ?? "Could not compute a price for this selection.");
    });
    return () => {
      ignore = true;
    };
  }, [trackId, packageId, countryId, selectionComplete]);

  function handleTrackChange(id: string) {
    setTrackId(id);
    setCategories(null);
    setCategoryId(null);
    setActivities(null);
    setAddableCategory(null);
    setAddableActivities(null);
    setSelectedActivityIds([]);
    setPackages(null);
    setPackageId(null);
    setEstimate(null);
    setEstimateError(null);
  }

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    setActivities(null);
    setAddableCategory(null);
    setAddableActivities(null);
    setSelectedActivityIds([]);
    setEstimate(null);
    setEstimateError(null);
  }

  function toggleActivity(id: string) {
    setSelectedActivityIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  function handlePackageChange(id: string) {
    setPackageId(id);
    setCountryId(null);
    setEstimate(null);
    setEstimateError(null);
  }

  function handleCountryChange(id: string) {
    setCountryId(id);
    setEstimate(null);
    setEstimateError(null);
  }

  async function handleConfirm() {
    if (!trackId || !packageId) return;
    setSubmitting(true);
    setSubmitError(null);
    const { ok, data, error } = await getJson<{ order: { id: string } }>("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackId,
        packageId,
        countryId,
        activityCategoryId: categoryId,
        activityIds: selectedActivityIds,
      }),
    });
    setSubmitting(false);
    if (ok && data) {
      router.push(`/orders/${data.order.id}`);
    } else {
      setSubmitError(error ?? "Could not create the order.");
    }
  }

  let stepNumber = 1;
  const trackStep = stepNumber++;
  const categoryStep = categoryEligible ? stepNumber++ : null;
  const activitiesStep = categoryEligible ? stepNumber++ : null;
  const packageStep = stepNumber++;
  const countryStep = stepNumber++;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">ابدأ رحلتك</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          اختر المسار ثم الباقة المناسبة، وشاهد السعر فورًا.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{trackStep}. اختر المسار</h2>
        {tracks === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <RadioGroup value={trackId ?? ""} onValueChange={handleTrackChange} className="gap-3">
            {tracks.map((track) => (
              <Label
                key={track.id}
                htmlFor={`track-${track.id}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem value={track.id} id={`track-${track.id}`} className="mt-1" />
                <span>
                  <span className="block font-medium">{track.nameAr}</span>
                  {track.description && (
                    <span className="text-muted-foreground block text-sm">{track.description}</span>
                  )}
                </span>
              </Label>
            ))}
          </RadioGroup>
        )}
      </section>

      {categoryEligible && trackId && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">{categoryStep}. اختر الفئة النشاطية</h2>
          {categories === null ? (
            <Skeleton className="h-24 w-full" />
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد فئات نشاطية متاحة حاليًا.</p>
          ) : (
            <RadioGroup value={categoryId ?? ""} onValueChange={handleCategoryChange} className="gap-3">
              {categories.map((category) => (
                <Label
                  key={category.id}
                  htmlFor={`category-${category.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary"
                >
                  <RadioGroupItem value={category.id} id={`category-${category.id}`} className="mt-1" />
                  <span className="block font-medium">{category.nameAr}</span>
                </Label>
              ))}
            </RadioGroup>
          )}
        </section>
      )}

      {categoryEligible && categoryId && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">{activitiesStep}. اختر الأنشطة (اختياري)</h2>
          {activities === null ? (
            <Skeleton className="h-16 w-full" />
          ) : activities.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد أنشطة متاحة لهذه الفئة حاليًا.</p>
          ) : (
            <div className="space-y-1 rounded-lg border p-2">
              {activities.map((activity) => (
                <label key={activity.id} className="hover:bg-muted flex items-center gap-2 rounded p-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedActivityIds.includes(activity.id)}
                    onChange={() => toggleActivity(activity.id)}
                  />
                  <span>{activity.nameAr}</span>
                </label>
              ))}
            </div>
          )}

          {addableCategory && (
            <div className="space-y-2 pt-2">
              <p className="text-muted-foreground text-sm">
                يمكنك أيضًا إضافة أنشطة من فئة «{addableCategory.nameAr}»:
              </p>
              {addableActivities === null ? (
                <Skeleton className="h-16 w-full" />
              ) : addableActivities.length === 0 ? (
                <p className="text-muted-foreground text-sm">لا توجد أنشطة متاحة لهذه الفئة حاليًا.</p>
              ) : (
                <div className="space-y-1 rounded-lg border p-2">
                  {addableActivities.map((activity) => (
                    <label key={activity.id} className="hover:bg-muted flex items-center gap-2 rounded p-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedActivityIds.includes(activity.id)}
                        onChange={() => toggleActivity(activity.id)}
                      />
                      <span>{activity.nameAr}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {packageStepReady && trackId && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">{packageStep}. اختر الباقة</h2>
          {packages === null ? (
            <Skeleton className="h-24 w-full" />
          ) : packages.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد باقات متاحة لهذا المسار حاليًا.</p>
          ) : (
            <RadioGroup value={packageId ?? ""} onValueChange={handlePackageChange} className="gap-3">
              {packages.map((pkg) => (
                <Label
                  key={pkg.id}
                  htmlFor={`pkg-${pkg.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary"
                >
                  <RadioGroupItem value={pkg.id} id={`pkg-${pkg.id}`} className="mt-1" />
                  <span className="flex-1">
                    <span className="block font-medium">{pkg.nameAr}</span>
                    {pkg.description && (
                      <span className="text-muted-foreground block text-sm">{pkg.description}</span>
                    )}
                    {pkg.requiresCountry && (
                      <Badge variant="secondary" className="mt-2">
                        يتطلب اختيار دولة
                      </Badge>
                    )}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          )}
        </section>
      )}

      {selectedPackage?.requiresCountry && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">{countryStep}. اختر الدولة</h2>
          {countries === null ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <RadioGroup value={countryId ?? ""} onValueChange={handleCountryChange} className="gap-3">
              {countries.map((country) => (
                <Label
                  key={country.id}
                  htmlFor={`country-${country.id}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary"
                >
                  <RadioGroupItem value={country.id} id={`country-${country.id}`} />
                  <span>{country.nameAr}</span>
                </Label>
              ))}
            </RadioGroup>
          )}
        </section>
      )}

      {(estimating || estimate || estimateError) && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle>السعر التقديري</CardTitle>
              <CardDescription>يُحسب تلقائيًا بناءً على اختياراتك</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {estimating && <Skeleton className="h-8 w-32" />}
              {estimateError && <p className="text-destructive text-sm">{estimateError}</p>}
              {estimate && (
                <>
                  <ul className="space-y-1 text-sm">
                    {estimate.breakdown.map((item) => (
                      <li key={item.stageId} className="flex justify-between">
                        <span className="text-muted-foreground">{item.nameAr}</span>
                        <span>{item.price.toLocaleString("ar-SA")} ريال</span>
                      </li>
                    ))}
                  </ul>
                  <Separator />
                  <div className="flex justify-between text-lg font-semibold">
                    <span>الإجمالي</span>
                    <span>{estimate.total.toLocaleString("ar-SA")} ريال</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {estimate && (
        <div className="space-y-2">
          {submitError && <p className="text-destructive text-sm">{submitError}</p>}
          <Button onClick={handleConfirm} disabled={submitting} className="w-full">
            {submitting ? "جارٍ الإنشاء..." : "تأكيد وإنشاء الطلب"}
          </Button>
        </div>
      )}
    </main>
  );
}
