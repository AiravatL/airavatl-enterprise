"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
} from "lucide-react";

import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PortalAccount } from "@/lib/api/portal-account";

import { Sidebar } from "./sidebar";

interface AppShellProps {
  account: PortalAccount;
  children: React.ReactNode;
}

export function AppShell({ account: serverAccount, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <TopBar
        account={serverAccount}
        onOpenMobile={() => setMobileOpen(true)}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        collapsed={collapsed}
      />

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar (in flow) */}
        <aside
          className={cn(
            "hidden lg:block lg:shrink-0 transition-[width] duration-200 ease-out",
            collapsed ? "lg:w-14" : "lg:w-64",
          )}
        >
          <Sidebar collapsed={collapsed} />
        </aside>

        {/* Mobile sidebar (overlay) */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-[1100] lg:hidden">
            <div
              className="fixed inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 top-14 z-[1110] w-64">
              <div className="flex h-full flex-col bg-white">
                <div className="flex h-10 items-center justify-end px-2">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                    aria-label="Close menu"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        ) : null}

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

interface TopBarProps {
  account: PortalAccount;
  onOpenMobile: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
}

function TopBar({
  account: serverAccount,
  onOpenMobile,
  onToggleCollapse,
  collapsed,
}: TopBarProps) {
  const { account: liveAccount, logout } = useAuth();
  const account = liveAccount ?? serverAccount;
  const initials = getInitials(account.fullName);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenMobile}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <Link
        href="/dashboard"
        className="flex items-center gap-2"
        aria-label="AiravatL home"
      >
        <Image
          src="/airavat-logo.svg"
          alt=""
          width={28}
          height={28}
          className="size-7 shrink-0 object-contain"
          priority
        />
        <span className="text-sm font-semibold tracking-tight text-gray-900 sm:text-[15px]">
          AiravatL
        </span>
      </Link>

      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="ml-2 hidden h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:inline-flex"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <PanelLeftClose className="size-4" />
        )}
      </button>

      <div className="flex-1" />

      <p className="hidden truncate text-xs text-muted-foreground sm:block">
        {account.customerName}
      </p>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open profile menu"
          className="group ml-2 flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2.5 text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 data-[state=open]:border-gray-300 data-[state=open]:bg-gray-50 sm:pr-3"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-violet-200 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200">
            {initials ?? <UserRound className="size-3.5" />}
          </span>
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-gray-800 sm:inline">
            {account.fullName}
          </span>
          <ChevronDown className="hidden size-3.5 text-gray-400 transition-transform group-data-[state=open]:rotate-180 sm:inline" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
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
    </header>
  );
}

function getInitials(name: string): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return null;
  return parts
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
