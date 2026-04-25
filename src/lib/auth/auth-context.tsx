"use client";

import { useEffect, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * Initialises the Zustand auth session listener exactly once. Mount this
 * inside the authenticated app shell — not at the root, otherwise the
 * /login page also subscribes and re-renders on every auth event.
 */
export function AuthInit({ children }: { children: ReactNode }) {
  const initSession = useAuthStore((s) => s._initSession);

  useEffect(() => {
    const cleanup = initSession();
    return cleanup;
  }, [initSession]);

  return <>{children}</>;
}

/**
 * Public hook for consuming the current portal account. Same shape as the
 * ERP `useAuth()` hook, scoped to portal accounts.
 */
export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      account: s.account,
      isAuthenticated: s.isAuthenticated,
      isLoading: s.isLoading,
      login: s.login,
      logout: s.logout,
    })),
  );
}
