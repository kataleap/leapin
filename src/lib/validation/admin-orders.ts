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

// Only the metadata fields — the file itself is read separately from
// FormData in the route handler (see saveUploadedFile in
// src/lib/storage/documents.ts). isVisibleToClient arrives as a string
// ("true"/"false") since it travels over multipart/form-data, not JSON.
export const documentUploadMetaSchema = z.object({
  documentType: z.enum(DocumentType),
  isVisibleToClient: z.preprocess((v) => v === "true" || v === true, z.boolean()),
});

// Phase 2 §5: 1–10 names per batch, not a fixed count.
export const tradeNameBatchSchema = z.object({
  names: z.array(z.string().min(1)).min(1).max(10),
});

export const tradeNameUpdateSchema = z.object({
  status: z.enum(TradeNameStatus),
});

export const otpRequestSchema = z.object({
  governmentPlatform: z.enum(GovernmentPlatform),
  metaTemplateName: z.string().min(1),
});
