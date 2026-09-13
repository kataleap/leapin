import Link from "next/link";
import { auth } from "@/auth";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { AccountMenu } from "@/components/account/account-menu";
import { sessionHasAccountingAccess } from "@/lib/auth/accounting";

const BASE_NAV = [{ href: "/admin", label: "طلباتي" }];

// Phase 6 §5.1: the accounting section is invisible to every admin account
// without the flag. Hiding the link is presentation only — /admin/accounting
// enforces the same check itself and 404s without it.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const showAccounting = await sessionHasAccountingAccess(session);
  const nav = showAccounting
    ? [...BASE_NAV, { href: "/admin/accounting", label: "المحاسبة" }]
    : BASE_NAV;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-4 text-sm">
        <div className="flex flex-wrap gap-4">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <AccountMenu profileHref="/admin/profile" />
        </div>
      </nav>
      {children}
    </div>
  );
}
