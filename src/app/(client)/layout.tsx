import Link from "next/link";
import { auth } from "@/auth";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <>
      {session?.user && (
        <header className="flex items-center justify-end gap-4 border-b px-4 py-2">
          <Link href="/orders" className="text-muted-foreground hover:text-foreground text-sm">
            طلباتي
          </Link>
          <Link href="/documents" className="text-muted-foreground hover:text-foreground text-sm">
            مستنداتي
          </Link>
          <NotificationBell />
        </header>
      )}
      {children}
    </>
  );
}
