import { z } from "zod";
import { CLIENT_UPLOADABLE_DOCUMENT_TYPES } from "@/lib/orders/client-actions";

// Only the metadata — the file itself is read from FormData in the route and
// validated by saveUploadedFile (type/size). Unlike the admin schema, there is
// no isVisibleToClient field: a document the client uploaded themselves is
// theirs to see, and the route sets it rather than trusting the request.
export const clientDocumentUploadMetaSchema = z.object({
  documentType: z.enum(CLIENT_UPLOADABLE_DOCUMENT_TYPES),
});

// Phase-2 scope §5.2: between one and ten names per batch — the rule the admin
// route already follows, now available on the side the scope document actually
// asked for ("نموذج تقديم الأسماء بواجهة العميل").
export const clientTradeNameBatchSchema = z.object({
  names: z
    .array(z.string().trim().min(1, "الاسم مطلوب").max(120))
    .min(1, "أدخل اسمًا واحدًا على الأقل")
    .max(10, "الحد الأقصى عشرة أسماء في الدفعة الواحدة")
    // Duplicates inside one batch are always a mistake — they burn a priority
    // slot on a name the registry will only ever answer once.
    .refine((names) => new Set(names.map((n) => n.trim())).size === names.length, {
      message: "لا يمكن تكرار نفس الاسم داخل الدفعة الواحدة",
    }),
});
