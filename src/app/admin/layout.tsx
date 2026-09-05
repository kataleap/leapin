import Link from "next/link";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { AccountMenu } from "@/components/account/account-menu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-8 flex items-center justify-between border-b pb-4">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">
          طلباتي
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <AccountMenu profileHref="/admin/profile" />
        </div>
      </nav>
      {children}
    </div>
  );
}
