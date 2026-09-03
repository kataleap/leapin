import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Prisma query results can carry Decimal/Date values that aren't directly
// assignable to Prisma's InputJsonValue type — round-trip through
// JSON.stringify (which both correctly stringifies Decimal/Date via their
// toJSON() methods and normalizes the shape) rather than fighting the types
// at every call site.
function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// Per doc §10.1: "Comprehensive audit_log for every change to pricing,
// packages, and user permissions — visible to super admin only." Called
// from every superadmin mutation (create/update/delete).
export async function logAudit(params: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: toJsonValue(params.oldValue),
      newValue: toJsonValue(params.newValue),
    },
  });
}
