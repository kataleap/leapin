import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { requirePageRole } from "@/lib/auth/require-page-role";
import { UserRole } from "@/generated/prisma/enums";

export default async function AuditLogPage() {
  await requirePageRole([UserRole.super_admin]);

  const entries = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { actorUser: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">سجل التدقيق</h1>
        <p className="text-muted-foreground mt-1 text-sm">آخر {entries.length} إجراء</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الوقت</TableHead>
            <TableHead>القائم بالإجراء</TableHead>
            <TableHead>الإجراء</TableHead>
            <TableHead>العنصر</TableHead>
            <TableHead>التفاصيل</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="whitespace-nowrap text-xs">
                {entry.createdAt.toLocaleString("ar-SA")}
              </TableCell>
              <TableCell className="text-xs">
                {entry.actorUser.name}
                <br />
                <span className="text-muted-foreground">{entry.actorUser.email}</span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{entry.action}</Badge>
              </TableCell>
              <TableCell className="text-xs">
                {entry.entityType}
                <br />
                <span className="text-muted-foreground">{entry.entityId}</span>
              </TableCell>
              <TableCell>
                {(entry.oldValue || entry.newValue) && (
                  <details>
                    <summary className="text-primary cursor-pointer text-xs">عرض</summary>
                    <div className="mt-2 space-y-2">
                      {entry.oldValue != null && (
                        <div>
                          <p className="text-muted-foreground text-xs">قبل</p>
                          <pre className="bg-muted max-w-xs overflow-x-auto rounded p-2 text-xs">
                            {JSON.stringify(entry.oldValue, null, 2)}
                          </pre>
                        </div>
                      )}
                      {entry.newValue != null && (
                        <div>
                          <p className="text-muted-foreground text-xs">بعد</p>
                          <pre className="bg-muted max-w-xs overflow-x-auto rounded p-2 text-xs">
                            {JSON.stringify(entry.newValue, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
