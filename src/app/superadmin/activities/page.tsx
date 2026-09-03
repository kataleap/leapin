import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export default async function ActivitiesListPage() {
  const activities = await prisma.activity.findMany({
    include: { category: true },
    orderBy: { nameAr: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">الأنشطة</h1>
        <Button nativeButton={false} render={<Link href="/superadmin/activities/new">+ إضافة نشاط</Link>} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>كود ميسا</TableHead>
            <TableHead>الاسم</TableHead>
            <TableHead>الفئة</TableHead>
            <TableHead>آخر مزامنة</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((activity) => (
            <TableRow key={activity.id}>
              <TableCell>
                <Link href={`/superadmin/activities/${activity.id}`} className="text-primary underline">
                  {activity.misaActivityCode}
                </Link>
              </TableCell>
              <TableCell>{activity.nameAr}</TableCell>
              <TableCell>{activity.category.nameAr}</TableCell>
              <TableCell>
                {activity.lastSyncedAt ? new Date(activity.lastSyncedAt).toLocaleDateString("ar-SA") : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={activity.isActive ? "default" : "outline"}>{activity.isActive ? "نشط" : "معطّل"}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
