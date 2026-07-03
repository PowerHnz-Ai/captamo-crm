"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { setAuthTokenGetter } from "@/lib/auth-token";
import { apiFetch } from "@/lib/api-fetch";
import { getUltraMode, isApiMode, type UltraMode } from "@/lib/ultra-mode";
import { getEffectiveRole, roleLabel } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export interface UserProfile {
  uid: string;
  email?: string;
  name?: string;
  username?: string;
  jobTitle?: string;
  photoUrl?: string;
  companyId: string;
  role?: UserRole | string;
  /** @deprecated Legacy field — use role */
  cargo?: string;
  effectiveRole: UserRole;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  ultraMode: UltraMode | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = ["/login"];

function isChecklistPath(pathname: string): boolean {
  return pathname.startsWith("/checklist");
}

function isApiPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/contacts") ||
    pathname.startsWith("/templates") ||
    pathname.startsWith("/campaigns") ||
    pathname.startsWith("/funnel") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/conversations")
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ultraMode, setUltraModeState] = useState<UltraMode | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshProfile = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      const data = await res.json();
      if (res.ok && data.authenticated) {
        const effectiveRole = getEffectiveRole({
          role: data.role,
          cargo: data.cargo,
        });
        setProfile({
          uid: data.uid,
          email: data.email,
          name: data.name,
          username: data.username,
          jobTitle: data.jobTitle,
          photoUrl: data.photoUrl,
          companyId: data.companyId,
          role: data.role,
          cargo: data.cargo,
          effectiveRole,
        });
        // Sinaliza ao ThemeProvider para sincronizar preferências da conta.
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("ultra-auth-ready"));
        }
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();

    setAuthTokenGetter(async () => {
      await auth.authStateReady();
      const current = auth.currentUser;
      if (!current) return null;
      try {
        return await current.getIdToken(false);
      } catch {
        return null;
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      setAuthTokenGetter(null);
    };
  }, []);

  useEffect(() => {
    if (user) {
      void refreshProfile();
      setUltraModeState(getUltraMode());
    } else {
      setProfile(null);
      setUltraModeState(null);
    }
  }, [user, refreshProfile]);

  useEffect(() => {
    if (!user || !profile) return;

    const sendHeartbeat = async () => {
      try {
        await apiFetch("/api/presence/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentSurface: pathname === "/hub" ? "hub" : "api",
            currentPath: pathname,
          }),
        });
      } catch {
        // ignore heartbeat failures
      }
    };

    void sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 60_000);
    return () => clearInterval(timer);
  }, [user, profile, pathname]);

  useEffect(() => {
    if (loading) return;

    if (!user && !PUBLIC_PATHS.includes(pathname)) {
      router.replace("/login");
      return;
    }

    if (user && pathname === "/login") {
      router.replace("/hub");
      return;
    }

    if (user && pathname !== "/hub" && pathname !== "/login" && !isChecklistPath(pathname)) {
      const mode = getUltraMode();
      const settingsPath = pathname.startsWith("/settings");

      if (!mode && !settingsPath) {
        router.replace("/hub");
        return;
      }

      const effectiveMode = mode || "api";
      const isOperacionalRoute =
        pathname.startsWith("/operacional") || isChecklistPath(pathname);
      const isCrmRoute = isApiPath(pathname);

      if (!isApiMode(effectiveMode) && isCrmRoute) {
        router.replace("/checklist/index.html");
      }

      if (isApiMode(effectiveMode) && isOperacionalRoute) {
        router.replace("/");
      }
    }
  }, [user, loading, pathname, router]);

  async function login(email: string, password: string) {
    const auth = getFirebaseAuth();
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    try {
      await apiFetch("/api/presence/offline", { method: "POST" });
    } catch {
      // ignore
    }
    const auth = getFirebaseAuth();
    await signOut(auth);
    router.replace("/login");
  }

  if (loading && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg text-app-subtle">
        Carregando...
      </div>
    );
  }

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg text-app-subtle">
        Redirecionando para login...
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, ultraMode, loading, login, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
