import Link from "next/link";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { AccountMenu } from "@/components/account/account-menu";

const NAV = [
  { href: "/superadmin", label: "الرئيسية" },
  { href: "/superadmin/stages", label: "المراحل" },
  { href: "/superadmin/packages", label: "الباقات" },
  { href: "/superadmin/payment-plans", label: "خطط الدفع" },
  { href: "/superadmin/countries", label: "الدول" },
  { href: "/superadmin/activity-categories", label: "الفئات النشاطية" },
  { href: "/superadmin/activities", label: "الأنشطة" },
  { href: "/superadmin/activity-mixing-rules", label: "قواعد الدمج" },
  { href: "/superadmin/users", label: "المستخدمون" },
  { href: "/superadmin/audit-log", label: "سجل التدقيق" },
  { href: "/superadmin/reports", label: "التقارير" },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-4 text-sm">
        <div className="flex flex-wrap gap-4">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <AccountMenu profileHref="/superadmin/profile" />
        </div>
      </nav>
      {children}
    </div>
  );
}
