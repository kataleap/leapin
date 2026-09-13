// What a client account must hold before the journey can ask its questions
// honestly. Each field is here because a later step consumes it, not because
// a form looked incomplete — that is the test for adding another one.

export type ProfileField = "nationality" | "residencyStatus" | "phone";

export const PROFILE_FIELD_LABEL: Record<ProfileField, { label: string; why: string }> = {
  nationality: {
    label: "الجنسية",
    why: "تحدّد الدول المتاحة لتأسيس شركة أجنبية بالوكالة — بعض الدول مقيّدة بجنسيات معيّنة.",
  },
  residencyStatus: {
    label: "صفة الإقامة (مقيم / غير مقيم)",
    why: "تحدّد ما إذا كانت رحلتك تتطلب خطاب عدم ممانعة.",
  },
  phone: {
    label: "رقم الهاتف",
    why: "قناة رمز التحقق والتواصل بشأن طلبك.",
  },
};

export function missingProfileFields(user: {
  nationality?: string | null;
  residencyStatus?: string | null;
  phone?: string | null;
}): ProfileField[] {
  const missing: ProfileField[] = [];
  if (!user.nationality) missing.push("nationality");
  if (!user.residencyStatus) missing.push("residencyStatus");
  if (!user.phone) missing.push("phone");
  return missing;
}

export function isProfileReadyForJourney(user: {
  nationality?: string | null;
  residencyStatus?: string | null;
  phone?: string | null;
}): boolean {
  return missingProfileFields(user).length === 0;
}
