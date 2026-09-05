"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { UserRound } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Popover-based to match NotificationBell's exact primitive/placement
// convention (no dropdown-menu component exists in this codebase). Replaces
// the old bare SignOutButton previously embedded in each dashboard page
// body — logout is now reachable from every page in a panel, not just its
// landing page.
export function AccountMenu({ profileHref }: { profileHref: string }) {
  return (
    <Popover>
      <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
        <UserRound className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <Link href={profileHref} className="block rounded-sm px-2 py-1.5 text-sm hover:bg-muted">
          الملف الشخصي
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="block w-full rounded-sm px-2 py-1.5 text-start text-sm hover:bg-muted"
        >
          تسجيل الخروج
        </button>
      </PopoverContent>
    </Popover>
  );
}
