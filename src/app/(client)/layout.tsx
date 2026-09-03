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
        <header className="flex items-center justify-end border-b px-4 py-2">
          <NotificationBell />
        </header>
      )}
      {children}
    </>
  );
}
