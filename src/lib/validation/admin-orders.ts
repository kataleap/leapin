import { z } from "zod";
import { OrderStageStatus, DocumentType, TradeNameStatus, GovernmentPlatform } from "@/generated/prisma/enums";

export const stageUpdateInputSchema = z
  .object({
    status: z.enum(OrderStageStatus).optional(),
    assignedAdminId: z.uuid().nullable().optional(),
    internalNotes: z.string().optional(),
  })
  .refine((d) => d.status !== undefined || d.assignedAdminId !== undefined || d.internalNotes !== undefined, {
    message: "At least one of status, assignedAdminId, or internalNotes must be provided.",
  });

export const documentUploadSchema = z.object({
  documentType: z.enum(DocumentType),
  fileUrl: z.url(),
  isVisibleToClient: z.boolean().optional().default(false),
});

// Doc §5.2: "5 names per batch."
export const tradeNameBatchSchema = z.object({
  names: z.array(z.string().min(1)).length(5),
});

export const tradeNameUpdateSchema = z.object({
  status: z.enum(TradeNameStatus),
});

export const otpRequestSchema = z.object({
  governmentPlatform: z.enum(GovernmentPlatform),
  metaTemplateName: z.string().min(1),
});
