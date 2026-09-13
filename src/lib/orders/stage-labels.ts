import type { OrderStageStatus } from "@/generated/prisma/enums";

// One Arabic vocabulary for stage status, shared by the client's order page
// and by the notifications sent about it. They used to disagree: the page
// translated the status while the notification interpolated the raw enum, so
// a client read «تغيّرت حالة مرحلة "..." إلى waiting_on_client».
export const STAGE_STATUS_LABEL: Record<OrderStageStatus, string> = {
  not_started: "لم تبدأ",
  in_progress: "قيد التنفيذ",
  waiting_on_client: "بانتظارك",
  waiting_on_government: "بانتظار الجهة الحكومية",
  blocked: "متوقفة",
  completed: "مكتملة",
  skipped: "خارج نطاق رحلتك",
};

export const STAGE_STATUS_VARIANT: Record<
  OrderStageStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  not_started: "outline",
  in_progress: "secondary",
  waiting_on_client: "secondary",
  waiting_on_government: "secondary",
  blocked: "destructive",
  completed: "default",
  skipped: "outline",
};
