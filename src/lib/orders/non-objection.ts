import { ResidencyStatus, NonObjectionLetterStatus } from "@/generated/prisma/enums";

// خطاب عدم ممانعة الكفيل — the sponsor's no-objection letter.
//
// The rule, as confirmed by the product owner and as doc §5.2 states it
// ("للمقيم غير السعودي داخل السعودية فقط"): a client residing in Saudi Arabia
// on an iqama is working under a sponsor, and that sponsor must state they do
// not object to the client establishing a company. The employer issues the
// letter, the client uploads it, our team reviews it.
//
// Nationality is part of the test, not decoration: an iqama is by definition
// held by a non-Saudi. A Saudi national living in Saudi Arabia has no sponsor
// to object, so asking them for a letter no employer can issue would block a
// journey for a document that cannot exist.
export const SAUDI_NATIONALITY_CODE = "SAU";

export function isNonObjectionLetterRequired(client: {
  residencyStatus?: string | null;
  nationality?: string | null;
}): boolean {
  if (client.residencyStatus !== ResidencyStatus.resident) return false;
  return client.nationality !== SAUDI_NATIONALITY_CODE;
}

export const NOL_STATUS_LABEL: Record<NonObjectionLetterStatus, string> = {
  not_submitted: "لم يُرفع بعد",
  under_review: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
};

export const NOL_STATUS_VARIANT: Record<
  NonObjectionLetterStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  not_submitted: "outline",
  under_review: "secondary",
  approved: "default",
  rejected: "destructive",
};

// What the client should do about it right now, in their own terms.
export const NOL_STATUS_HINT: Record<NonObjectionLetterStatus, string> = {
  not_submitted:
    "بصفتك مقيمًا في السعودية، يلزم خطاب عدم ممانعة من صاحب العمل (الكفيل) يفيد بعدم ممانعته تأسيسك للشركة. اطلبه من جهة عملك ثم ارفعه هنا.",
  under_review: "استلمنا الخطاب وهو قيد المراجعة من فريقنا.",
  approved: "تم اعتماد خطاب عدم الممانعة.",
  rejected: "لم يُقبل الخطاب المرفوع. راجع سبب الرفض أدناه ثم ارفع خطابًا بديلًا.",
};

export type NolActionVerdict = { allowed: true } | { allowed: false; reason: string };

/**
 * A client may upload (or replace) the letter while it is missing or rejected.
 * While it is under review, a second upload would only race the reviewer; once
 * approved, re-uploading would silently invalidate a decision already made.
 */
export function canClientSubmitNonObjectionLetter(letter: {
  isRequired: boolean;
  status: NonObjectionLetterStatus;
}): NolActionVerdict {
  if (!letter.isRequired) {
    return { allowed: false, reason: "طلبك لا يتطلب خطاب عدم ممانعة." };
  }
  if (letter.status === NonObjectionLetterStatus.under_review) {
    return { allowed: false, reason: "الخطاب قيد المراجعة حاليًا — انتظر نتيجة المراجعة." };
  }
  if (letter.status === NonObjectionLetterStatus.approved) {
    return { allowed: false, reason: "تم اعتماد الخطاب بالفعل." };
  }
  return { allowed: true };
}

/**
 * Staff review only what is actually in front of them: a letter that was never
 * uploaded, or one already decided, is not reviewable.
 */
export function canStaffReviewNonObjectionLetter(letter: {
  isRequired: boolean;
  status: NonObjectionLetterStatus;
}): NolActionVerdict {
  if (!letter.isRequired) {
    return { allowed: false, reason: "This order does not require a no-objection letter." };
  }
  if (letter.status !== NonObjectionLetterStatus.under_review) {
    return { allowed: false, reason: "No letter is currently awaiting review on this order." };
  }
  return { allowed: true };
}
