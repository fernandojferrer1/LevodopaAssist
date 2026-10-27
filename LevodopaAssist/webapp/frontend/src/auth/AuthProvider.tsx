import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigError } from "./supabase";
import { setUnauthorizedHandler } from "../api/client";
import { INACTIVITY_TIMEOUT_MS } from "./sessionConfig";
import { isMeasurementBusy, onMeasurementBusyChange } from "./measurementBusy";
import { setSessionEndMessage } from "./sessionEndMessage";

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

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

export function AuthProvider({
  children,
  onUnauthorized,
  onInactivity,
}: {
  children: ReactNode;
  onUnauthorized: () => void;
  onInactivity: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const onInactivityRef = useRef(onInactivity);
  onInactivityRef.current = onInactivity;
  /** Evita que un getSession() inicial tardío pise un SIGNED_IN / signIn reciente. */
  const authEpochRef = useRef(0);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const bootEpoch = authEpochRef.current;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      // Si ya hubo un evento de auth más nuevo (login), no sobrescribir.
      if (authEpochRef.current !== bootEpoch) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // No llamar métodos de supabase.auth acá (lock interno). Diferir setState
      // un tick para no bloquear getSession/fetch que corren al montar rutas.
      setTimeout(() => {
        if (cancelled) return;
        authEpochRef.current += 1;
        setSession(next);
        setLoading(false);
        if (event === "SIGNED_OUT") {
          // noop: el mensaje de cierre lo setea quien dispara el logout
        }
      }, 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSessionEndMessage("Tu sesión expiró, ingresá de nuevo");
      onUnauthorized();
      void supabase?.auth.signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [onUnauthorized]);

  // Timeout de inactividad (pausado si hay medición en curso / sin guardar).
  useEffect(() => {
    if (!session || !supabase) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const logoutForInactivity = async () => {
      clearTimer();
      setSessionEndMessage("Se cerró la sesión por inactividad");
      onInactivityRef.current();
      await supabase!.auth.signOut();
    };

    const armTimer = () => {
      clearTimer();
      if (isMeasurementBusy()) return;
      timer = setTimeout(() => {
        if (isMeasurementBusy()) {
          return;
        }
        void logoutForInactivity();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const onActivity = () => {
      if (isMeasurementBusy()) return;
      armTimer();
    };

    armTimer();

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    const unsubscribeBusy = onMeasurementBusyChange(() => {
      if (isMeasurementBusy()) {
        clearTimer();
      } else {
        armTimer();
      }
    });

    return () => {
      clearTimer();
      unsubscribeBusy();
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [session]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(supabaseConfigError ?? "Supabase no configurado");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes("invalid login") || error.status === 400) {
        throw new Error("Email o contraseña incorrectos");
      }
      if (error.message.toLowerCase().includes("fetch") || error.name === "AuthRetryableFetchError") {
        throw new Error("No se pudo conectar, revisá tu conexión");
      }
      throw new Error(error.message || "Email o contraseña incorrectos");
    }
    // Fijar sesión en React de inmediato (no depender solo del listener async).
    authEpochRef.current += 1;
    setSession(data.session);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const refreshUserFromSession = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    authEpochRef.current += 1;
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
