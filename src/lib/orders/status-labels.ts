import type { OrderStatus } from "@/generated/prisma/enums";

// Deliberately free of any server-only import (no prisma) so client components
// can use it too — and in one place rather than per page, which is how
// "طلباتي" ended up showing the client the raw English enum value while the
// super-admin report showed a translated one.
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "مسوّدة",
  pending_payment: "بانتظار الدفع",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغى",
  on_hold: "معلّق",
};

export const ORDER_STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending_payment: "secondary",
  in_progress: "secondary",
  completed: "default",
  cancelled: "destructive",
  on_hold: "destructive",
};

// What the status means for the client, in the client's terms — a status word
// alone doesn't tell them whether the ball is in their court.
export const ORDER_STATUS_HINT: Record<OrderStatus, string> = {
  draft: "طلبك مسجَّل ولم تُستحق عليه أي دفعة بعد.",
  pending_payment: "بانتظار سداد الدفعة المستحقة لبدء التنفيذ.",
  in_progress: "فريقنا يعمل على طلبك حاليًا.",
  completed: "اكتملت جميع مراحل طلبك وسُدّدت مستحقاته.",
  cancelled: "أُلغي هذا الطلب.",
  on_hold: "الطلب معلَّق مؤقتًا — سيتواصل معك فريقنا.",
};

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status;
}
