"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: "order_created" | "stage_assigned" | "stage_status_changed";
  title: string;
  message: string;
  orderId: string | null;
  isRead: boolean;
};

// Staff-facing types (order_created, stage_assigned) link into the admin
// order view; the client-facing type links into the client tracking page.
function orderHref(notification: Notification) {
  if (!notification.orderId) return null;
  return notification.type === "stage_status_changed"
    ? `/orders/${notification.orderId}`
    : `/admin/orders/${notification.orderId}`;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();

  const load = useCallback(async () => {
    // Per-user data on a fixed URL — without this, the browser can (and,
    // confirmed in testing, does) serve a different user's cached response.
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }, []);

  // A signed-in-as-a-different-user transition (e.g. straight after login)
  // is a client-side route change, not a full reload — this component's
  // instance can survive it, so re-fetch on every pathname change rather
  // than relying solely on the mount-only effect below.
  useEffect(() => {
    // `load`'s setState calls happen after an internal await, not
    // synchronously in this effect body — the lint rule's static analysis
    // can't see through that, but this is the documented fetch-on-mount
    // (and, here, fetch-on-route-change) pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [pathname, load]);

  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PUT" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <Popover onOpenChange={(open) => open && load()}>
      <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}>
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full text-[10px]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-medium">الإشعارات</span>
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead} className="text-primary text-xs underline">
              تحديد الكل كمقروء
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-sm">لا توجد إشعارات.</p>
          ) : (
            notifications.map((n) => {
              const href = orderHref(n);
              const content = (
                <>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground mt-0.5">{n.message}</p>
                </>
              );
              const className = cn(
                "block w-full border-b p-3 text-start text-sm last:border-0 hover:bg-muted",
                !n.isRead && "bg-accent/50"
              );
              return href ? (
                <Link key={n.id} href={href} onClick={() => !n.isRead && markRead(n.id)} className={className}>
                  {content}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={className}
                >
                  {content}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
