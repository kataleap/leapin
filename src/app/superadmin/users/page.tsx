import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const ROLE_LABEL: Record<string, string> = {
  client: "عميل",
  admin: "أدمن",
  super_admin: "سوبر أدمن",
};

export default async function UsersListPage() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">المستخدمون</h1>
        <Button nativeButton={false} render={<Link href="/superadmin/users/new">+ إضافة مستخدم</Link>} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الاسم</TableHead>
            <TableHead>البريد الإلكتروني</TableHead>
            <TableHead>الدور</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Link href={`/superadmin/users/${user.id}`} className="text-primary underline">
                  {user.name}
                </Link>
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant="secondary">{ROLE_LABEL[user.role] ?? user.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={user.isActive ? "default" : "outline"}>
                  {user.isActive ? "نشط" : "معطّل"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
