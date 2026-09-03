import { z } from "zod";
import { StageTrackScope, StageActor, StageStatus } from "@/generated/prisma/enums";

// Fields with no default — safe to reuse as-is for both create and update.
// requiresClientPresence/status get defaults ONLY on the create schema below:
// zod's `.default()` still fires on a field that's absent from the input
// even after `.partial()`, so if the update schema kept `.default(...)`, a
// PUT that omits e.g. `status` would silently reset it to "active" instead
// of leaving it untouched. Never reuse a `.default()`-bearing schema for a
// partial update.
const shape = {
  code: z.string().min(1).max(32),
  trackScope: z.enum(StageTrackScope),
  nameAr: z.string().min(1),
  description: z.string().optional(),
  sequenceOrder: z.number().int(),
  parentStageId: z.uuid().nullable().optional(),
  primaryActor: z.enum(StageActor),
  requiresClientPresence: z.boolean().optional(),
  status: z.enum(StageStatus).optional(),
};

export const stageCreateSchema = z.object(shape).extend({
  requiresClientPresence: z.boolean().default(false),
  status: z.enum(StageStatus).default("active"),
});

export const stageUpdateSchema = z.object(shape).partial();
