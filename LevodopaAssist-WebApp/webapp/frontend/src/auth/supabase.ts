import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigError =
  !url || !publishableKey
    ? "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Copiá webapp/frontend/.env.example a .env.local y completá los valores (en Vercel: Environment Variables + redeploy)."
    : null;

/** Quita sesiones de versiones anteriores en localStorage (claves sb-*). Solo al cargar el módulo; no toca sessionStorage. */
function clearLegacyAuthLocalStorage(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith("sb-")) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    window.localStorage.removeItem(key);
  }
}

function sessionStorageAdapter(): SupportedStorage | undefined {
  if (typeof window === "undefined" || !window.sessionStorage) return undefined;
  const store = window.sessionStorage;
  return {
    getItem: (key) => store.getItem(key),
    setItem: (key, value) => {
      store.setItem(key, value);
    },
    removeItem: (key) => {
      store.removeItem(key);
    },
  };
}

if (typeof window !== "undefined") {
  clearLegacyAuthLocalStorage();
}

export const supabase: SupabaseClient | null = supabaseConfigError
  ? null
  : createClient(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: sessionStorageAdapter(),
      },
    });
