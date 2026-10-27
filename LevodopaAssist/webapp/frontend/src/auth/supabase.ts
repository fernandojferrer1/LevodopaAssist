import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigError =
  !url || !publishableKey
    ? "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Copiá webapp/frontend/.env.example a .env.local y completá los valores (en Vercel: Environment Variables + redeploy)."
    : null;

export const supabase: SupabaseClient | null = supabaseConfigError
  ? null
  : createClient(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
