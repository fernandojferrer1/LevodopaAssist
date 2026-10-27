import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigError } from "./supabase";
import { setUnauthorizedHandler } from "../api/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-login in-place (p. ej. modal sobre medición) sin navegar. */
  refreshUserFromSession: () => Promise<Session | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  onUnauthorized,
}: {
  children: ReactNode;
  onUnauthorized: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void supabase?.auth.signOut();
      onUnauthorized();
    });
    return () => setUnauthorizedHandler(null);
  }, [onUnauthorized]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(supabaseConfigError ?? "Supabase no configurado");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes("invalid login") || error.status === 400) {
        throw new Error("Email o contraseña incorrectos");
      }
      if (error.message.toLowerCase().includes("fetch") || error.name === "AuthRetryableFetchError") {
        throw new Error("No se pudo conectar, revisá tu conexión");
      }
      throw new Error(error.message || "Email o contraseña incorrectos");
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const refreshUserFromSession = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    return data.session;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configError: supabaseConfigError,
      signIn,
      signOut,
      refreshUserFromSession,
    }),
    [session, loading, signIn, signOut, refreshUserFromSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
