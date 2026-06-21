"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Gavel,
  Truck,
  LogOut,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Tab {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Extra path prefixes that should also mark this tab active. */
  match?: string[];
}

const TABS: Tab[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Auctions", href: "/auctions", icon: Gavel, match: ["/requests"] },
  {
    label: "Trips",
    href: "/active-trips",
    icon: Truck,
    match: ["/trips", "/trip-history"],
  },
];

function isActive(pathname: string, tab: Tab): boolean {
  const prefixes = [tab.href, ...(tab.match ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Mobile-only bottom tab bar. Hidden at lg+, where the sidebar takes over.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-around rounded-3xl border border-gray-100 bg-white px-2 py-2 shadow-lg">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-center rounded-full text-xs font-medium transition-colors",
                active
                  ? "gap-1.5 bg-primary/10 px-4 py-2 text-primary"
                  : "flex-col gap-0.5 px-3 py-1.5 text-gray-400 hover:text-gray-600",
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <ProfileTab />
      </div>
    </nav>
  );
}

function ProfileTab() {
  const { account, logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-xs font-medium text-gray-400 outline-none hover:text-gray-600 data-[state=open]:text-primary">
        <UserRound className="size-5 shrink-0" />
        <span>Profile</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="mb-2 w-60">
        {account ? (
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="truncate text-sm font-semibold text-gray-900">
              {account.fullName}
            </span>
            <span className="truncate text-xs font-normal text-gray-500">
              {account.email}
            </span>
            <span className="mt-1 truncate text-[11px] font-normal text-gray-400">
              {account.customerName}
            </span>
          </DropdownMenuLabel>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void logout();
          }}
          className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
