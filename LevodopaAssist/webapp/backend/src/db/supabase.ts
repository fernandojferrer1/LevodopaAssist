import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. ` +
        `En local: copiá webapp/backend/.env.example a .env y completá SUPABASE_URL y SUPABASE_SECRET_KEY. ` +
        `En Vercel: Project Settings → Environment Variables (Production / Preview / Development).`
    );
  }
  return value;
}

const url = requireEnv("SUPABASE_URL");
const key = requireEnv("SUPABASE_SECRET_KEY");

export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
