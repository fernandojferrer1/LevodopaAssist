import type { NextFunction, Request, Response } from "express";
import { supabase } from "../db/supabase";

export type AuthUser = {
  userId: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

/**
 * Valida el Bearer JWT con supabase.auth.getClaims(jwt).
 *
 * Por qué getClaims y no getUser: getClaims verifica la firma del access token
 * (JWKS local con claves asimétricas, o Auth server si el proyecto usa HS256) y
 * no confía en un objeto user sin verificar. getUser siempre pega a Auth y es
 * más lento; la doc vigente lo recomienda para "fresh user record", no para
 * autorización de cada request.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const claims = data.claims as { sub?: string; email?: string };
    const userId = typeof claims.sub === "string" ? claims.sub : null;
    if (!userId) {
      return res.status(401).json({ error: "No autorizado" });
    }

    req.auth = {
      userId,
      email: typeof claims.email === "string" ? claims.email : "",
    };
    next();
  } catch (err) {
    console.error("requireAuth:", err);
    return res.status(401).json({ error: "No autorizado" });
  }
}

/** Log mínimo de auditoría para mutaciones (sin datos clínicos). */
export function auditMutation(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method !== "POST" && method !== "PATCH" && method !== "DELETE") {
    return next();
  }

  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    const email = req.auth?.email || "(sin email)";
    const resourceId =
      (typeof req.params.id === "string" && req.params.id) ||
      (typeof req.params.patientId === "string" && req.params.patientId) ||
      "-";
    console.log(
      `[audit] ${new Date().toISOString()} email=${email} ${method} ${req.originalUrl} resource=${resourceId}`
    );
  });

  next();
}
