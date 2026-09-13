import { prisma } from "@/lib/prisma";

// Batch creation, shared by the admin route (which has submitted names on a
// client's behalf since phase 2) and the client route. The batch number is
// derived from what is already stored, so both callers land in the same
// sequence rather than each keeping its own count.
export async function createTradeNameBatch(orderId: string, names: string[]) {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.tradeName.findFirst({
      where: { orderId },
      orderBy: { batchNumber: "desc" },
    });
    const batchNumber = (latest?.batchNumber ?? 0) + 1;
    const now = new Date();

    await tx.tradeName.createMany({
      data: names.map((nameAr, index) => ({
        orderId,
        nameAr,
        // Order of submission is the client's own priority order — the first
        // name is the one they most want.
        priorityRank: index + 1,
        batchNumber,
        status: "submitted" as const,
        submittedAt: now,
      })),
    });

    return tx.tradeName.findMany({ where: { orderId, batchNumber }, orderBy: { priorityRank: "asc" } });
  });
}
