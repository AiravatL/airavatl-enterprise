import { create } from "zustand";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentAccount } from "@/lib/api/auth";
import type { PortalAccount } from "@/lib/api/portal-account";

interface AuthState {
  account: PortalAccount | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  _initSession: () => () => void;
}

const PROFILE_CACHE_TTL_MS = 5 * 60_000;
const PROFILE_STORAGE_KEY = "ent:auth:account";

let _loginInProgress = false;
let _initialSessionChecked = false;
let _profileInFlight: Promise<PortalAccount | null> | null = null;
let _profileCache: { value: PortalAccount | null; at: number } | null = null;

function readStoredProfile(): { value: PortalAccount | null; at: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: PortalAccount | null; at: number };
    if (!parsed || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredProfile(entry: { value: PortalAccount | null; at: number }) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // quota / privacy mode — ignore
  }
}

function clearStoredProfile() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

if (typeof window !== "undefined") {
  const stored = readStoredProfile();
  if (stored && Date.now() - stored.at < PROFILE_CACHE_TTL_MS) {
    _profileCache = stored;
  }
}

function clearProfileCache() {
  _profileInFlight = null;
  _profileCache = null;
  clearStoredProfile();
}

function isProfileCacheFresh() {
  if (!_profileCache) return false;
  return Date.now() - _profileCache.at < PROFILE_CACHE_TTL_MS;
}

async function fetchAccount(options?: { force?: boolean }): Promise<PortalAccount | null> {
  const force = options?.force ?? false;

  if (!force && isProfileCacheFresh()) {
    return _profileCache?.value ?? null;
  }

  if (!force && _profileInFlight) {
    return _profileInFlight;
  }

  _profileInFlight = (async () => {
    try {
      const account = await getCurrentAccount();
      const entry = { value: account, at: Date.now() };
      _profileCache = entry;
      writeStoredProfile(entry);
      return account;
    } catch {
      const entry = { value: null, at: Date.now() };
      _profileCache = entry;
      return null;
    } finally {
      _profileInFlight = null;
    }
  })();

  return _profileInFlight;
}

// NOTE: Initial state must match on server and client to avoid hydration
// mismatches. The sessionStorage seed only warms the in-flight cache; the
// first synchronous render still shows the loading state.
export const useAuthStore = create<AuthState>()((set) => ({
  account: null,
  isAuthenticated: false,
  isLoading: true,

  _initSession: () => {
    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    const loadingFallbackTimer = window.setTimeout(() => {
      if (isMounted) set({ isLoading: false });
    }, 8000);

    const stopLoading = () => {
      clearTimeout(loadingFallbackTimer);
      if (isMounted) set({ isLoading: false });
    };

    async function initSession() {
      if (_initialSessionChecked) {
        stopLoading();
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (isMounted) set({ account: null, isAuthenticated: false });
          stopLoading();
          return;
        }

        if (isMounted) set({ isAuthenticated: true, isLoading: false });
        stopLoading();

        const account = await fetchAccount();

        if (!account || !account.active) {
          await supabase.auth.signOut();
          clearProfileCache();
          if (isMounted) set({ account: null, isAuthenticated: false });
          return;
        }

        if (isMounted) set({ account, isAuthenticated: true });
      } catch {
        if (isMounted) set({ isLoading: false });
      } finally {
        _initialSessionChecked = true;
      }
    }

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        void (async () => {
          if (!isMounted) return;

          if (event === "INITIAL_SESSION") return;

          if (event === "SIGNED_OUT") {
            clearProfileCache();
            set({ account: null, isAuthenticated: false, isLoading: false });
            return;
          }

          if (_loginInProgress) return;

          if (event === "TOKEN_REFRESHED" && session?.user) {
            const current = useAuthStore.getState();
            if (
              current.isAuthenticated &&
              current.account &&
              isProfileCacheFresh()
            ) {
              return;
            }
          }

          if (session?.user) {
            if (isMounted) set({ isAuthenticated: true, isLoading: false });

            const account = await fetchAccount();
            if (!account || !account.active) {
              await supabase.auth.signOut();
              clearProfileCache();
              if (isMounted) set({ account: null, isAuthenticated: false });
              return;
            }

            if (isMounted) set({ account, isAuthenticated: true });
            return;
          }

          set({ account: null, isAuthenticated: false, isLoading: false });
        })();
      },
    );

    return () => {
      isMounted = false;
      clearTimeout(loadingFallbackTimer);
      subscription.unsubscribe();
    };
  },

  login: async (email, password) => {
    if (_loginInProgress) {
      return { ok: false, message: "Login already in progress" };
    }

    _loginInProgress = true;
    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        return {
          ok: false,
          message: "Invalid email or password",
        };
      }

      const account = await fetchAccount({ force: true });

      if (!account || !account.active) {
        // Auth succeeded but no portal access — drop the session and surface
        // an ambiguous error to avoid leaking that the credentials were valid.
        await supabase.auth.signOut();
        clearProfileCache();
        return {
          ok: false,
          message: "Invalid email or password, or this account doesn't have portal access.",
        };
      }

      set({ account, isAuthenticated: true, isLoading: false });
      return { ok: true };
    } catch {
      return { ok: false, message: "Unexpected error during sign-in" };
    } finally {
      _loginInProgress = false;
    }
  },

  logout: async () => {
    set({ account: null, isAuthenticated: false, isLoading: false });
    clearProfileCache();

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // network error — local state is already cleared
    }

    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },
}));
