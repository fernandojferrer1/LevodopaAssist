/**
 * Smoke test de autenticación (sin usuarios reales).
 * Requiere: backend en marcha (`npm run dev`) con SUPABASE_URL y SUPABASE_SECRET_KEY.
 *
 * El CRUD con login se prueba a mano desde la UI (ver README.md).
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4000/api";

type StepResult = { name: string; ok: boolean; detail?: string };
const results: StepResult[] = [];

function log(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`[${ok ? "OK  " : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function raw(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function isUnauthorized(status: number, body: unknown): boolean {
  return status === 401 && typeof body === "object" && body !== null && (body as { error?: string }).error === "No autorizado";
}

async function main() {
  console.log(`Smoke test (auth) → ${BASE}\n`);

  const health = await raw("/health");
  log("GET /health sin auth → 200", health.status === 200 && (health.body as { status?: string }).status === "ok", `HTTP ${health.status}`);

  const protectedChecks: { name: string; path: string; init?: RequestInit }[] = [
    { name: "GET /patients", path: "/patients" },
    { name: "POST /patients", path: "/patients", init: { method: "POST", body: JSON.stringify({ fullName: "x", age: 1 }) } },
    { name: "GET /patients/:id", path: "/patients/fake-id" },
    { name: "PATCH /patients/:id", path: "/patients/fake-id", init: { method: "PATCH", body: JSON.stringify({ fullName: "x" }) } },
    { name: "GET /patients/:id/measurements", path: "/patients/fake-id/measurements" },
    {
      name: "POST /patients/:id/measurements",
      path: "/patients/fake-id/measurements",
      init: { method: "POST", body: JSON.stringify({}) },
    },
    { name: "GET /measurements/:id", path: "/measurements/fake-id" },
    { name: "DELETE /measurements/:id", path: "/measurements/fake-id", init: { method: "DELETE" } },
    { name: "GET /patients/:id/comparisons", path: "/patients/fake-id/comparisons" },
    {
      name: "POST /patients/:id/comparisons",
      path: "/patients/fake-id/comparisons",
      init: { method: "POST", body: JSON.stringify({ measurementAId: "a", measurementBId: "b" }) },
    },
    { name: "GET /comparisons/:id", path: "/comparisons/fake-id" },
  ];

  for (const check of protectedChecks) {
    const r = await raw(check.path, check.init);
    log(`${check.name} sin Authorization → 401`, isUnauthorized(r.status, r.body), `HTTP ${r.status}`);
  }

  for (const check of protectedChecks) {
    const r = await raw(check.path, {
      ...check.init,
      headers: { Authorization: "Bearer abc123", ...(check.init?.headers as Record<string, string> | undefined) },
    });
    log(`${check.name} Bearer abc123 → 401`, isUnauthorized(r.status, r.body), `HTTP ${r.status}`);
  }

  /*
   * Flujo completo (paciente → mediciones → comparación → cleanup) DESHABILITADO.
   * Requiere un usuario real de Supabase Auth y se prueba a mano desde la UI:
   * login → crear paciente → medición → comparación → logout.
   */

  const failed = results.filter((r) => !r.ok);
  console.log(`\nResumen: ${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error("Smoke abortó:", err);
  process.exit(1);
});
