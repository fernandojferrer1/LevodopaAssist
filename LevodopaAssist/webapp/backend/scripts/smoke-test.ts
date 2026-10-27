/**
 * Smoke test contra el backend en http://127.0.0.1:4000.
 * Requiere: npm run dev en otra terminal (con .env de Supabase).
 * Al final borra pacientes/mediciones de prueba vía service role.
 */

import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4000/api";

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL / SUPABASE_SECRET_KEY para la limpieza final");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type StepResult = { name: string; ok: boolean; detail?: string };

const results: StepResult[] = [];

function log(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  const tag = ok ? "OK  " : "FAIL";
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

/** Envolvente sintética ~10s / ~700 muestras con picos claros (pasa detectContractions). */
function syntheticRawSamples(n = 700, durationMs = 10000): number[] {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * durationMs;
    let v = 1000 + Math.sin(i * 0.05) * 15;
    const cycle = t % 650;
    if (cycle > 80 && cycle < 320) {
      const phase = (cycle - 80) / 240;
      v = 1000 + 1300 * Math.sin(phase * Math.PI);
    }
    samples.push(Math.round(v));
  }
  return samples;
}

function measurementBody(medicationState: "sin_levodopa" | "post_levodopa", rawSamples: number[]) {
  return {
    medicationState,
    measuredAt: new Date().toISOString(),
    location: "smoke-lab",
    notes: "smoke-test",
    status: "completed",
    conNum: 0,
    timerMedicionMs: 10000,
    conXMinuto: 0,
    peakMax: 0,
    promedioPeaks: 0,
    yyn: 0,
    promedioLthMs: 0,
    promedioBtwMs: 0,
    thresh: 0,
    contractions: [],
    rawSamples,
  };
}

async function main() {
  console.log(`Smoke test → ${BASE}\n`);

  const health = await request<{ status: string }>("/health");
  log("health", health.status === 200 && health.body.status === "ok", `HTTP ${health.status}`);
  if (health.status !== 200) {
    console.error("Backend no saludable; abortando.");
    process.exit(1);
  }

  const unique = `Smoke ${Date.now()}`;
  const created = await request<{ id: string; fullName: string }>("/patients", {
    method: "POST",
    body: JSON.stringify({
      fullName: unique,
      age: 60,
      nationalId: `SMK${Date.now()}`,
      diagnosis: "Parkinson",
    }),
  });
  log("crear paciente", created.status === 201 && !!created.body.id, `HTTP ${created.status}`);
  const patientId = created.body.id;
  if (!patientId) {
    process.exit(1);
  }

  const searchUpper = await request<unknown[]>(`/patients?q=${encodeURIComponent(unique.toUpperCase())}`);
  const foundUpper = Array.isArray(searchUpper.body) && searchUpper.body.some((p: any) => p.id === patientId);
  log("buscar ?q= MAYÚSCULAS (ilike)", searchUpper.status === 200 && foundUpper);

  const searchLower = await request<unknown[]>(`/patients?q=${encodeURIComponent(unique.toLowerCase())}`);
  const foundLower = Array.isArray(searchLower.body) && searchLower.body.some((p: any) => p.id === patientId);
  log("buscar ?q= minúsculas (ilike)", searchLower.status === 200 && foundLower);

  const raw = syntheticRawSamples(700);
  const m1 = await request<any>(`/patients/${patientId}/measurements`, {
    method: "POST",
    body: JSON.stringify(measurementBody("sin_levodopa", raw)),
  });
  log(
    "crear medición sin_levodopa",
    m1.status === 201 && m1.body.sequenceNumber === 1 && m1.body.detectionSource === "backend",
    `seq=${m1.body.sequenceNumber} source=${m1.body.detectionSource} HTTP ${m1.status}`
  );

  const m2 = await request<any>(`/patients/${patientId}/measurements`, {
    method: "POST",
    body: JSON.stringify(measurementBody("post_levodopa", raw)),
  });
  log(
    "crear medición post_levodopa",
    m2.status === 201 && m2.body.sequenceNumber === 2,
    `seq=${m2.body.sequenceNumber} HTTP ${m2.status}`
  );

  const cmp = await request<any>(`/patients/${patientId}/comparisons`, {
    method: "POST",
    body: JSON.stringify({ measurementAId: m1.body.id, measurementBId: m2.body.id }),
  });
  log("crear comparación", cmp.status === 201 && !!cmp.body.id && !!cmp.body.metrics, `HTTP ${cmp.status}`);

  const listCmp = await request<any[]>(`/patients/${patientId}/comparisons`);
  const listed = Array.isArray(listCmp.body) && listCmp.body.some((c) => c.id === cmp.body.id);
  const listHasRaw =
    listed &&
    listCmp.body.some(
      (c) =>
        c.id === cmp.body.id &&
        (c.measurementA?.rawSamplesJson || c.measurementB?.rawSamplesJson)
    );
  log(
    "listar comparaciones (sin raw en A/B)",
    listCmp.status === 200 && listed && !listHasRaw,
    listHasRaw ? "todavía trae rawSamplesJson" : `n=${Array.isArray(listCmp.body) ? listCmp.body.length : 0}`
  );

  const detail = await request<any>(`/measurements/${m1.body.id}`);
  log(
    "GET detalle medición",
    detail.status === 200 &&
      Array.isArray(detail.body.contractions) &&
      typeof detail.body.rawSamplesJson === "string",
    `contractions=${detail.body.contractions?.length} HTTP ${detail.status}`
  );

  const del = await request<{ ok: boolean }>(`/measurements/${m1.body.id}`, { method: "DELETE" });
  log("DELETE medición (cascada comparisons)", del.status === 200 && del.body.ok === true);

  const listCmpAfter = await request<any[]>(`/patients/${patientId}/comparisons`);
  const cmpGone =
    Array.isArray(listCmpAfter.body) && !listCmpAfter.body.some((c) => c.id === cmp.body.id);
  log("comparación borrada con la medición", cmpGone);

  // --- Concurrencia: 5 POST en paralelo a otro paciente limpio ---
  const parallelPatient = await request<{ id: string }>("/patients", {
    method: "POST",
    body: JSON.stringify({
      fullName: `Smoke Parallel ${Date.now()}`,
      age: 55,
      nationalId: `SMP${Date.now()}`,
    }),
  });
  const parallelId = parallelPatient.body.id;
  const parallelRaw = syntheticRawSamples(700);
  const parallelBodies = Array.from({ length: 5 }, (_, i) =>
    measurementBody(i % 2 === 0 ? "sin_levodopa" : "post_levodopa", parallelRaw)
  );
  const parallelResults = await Promise.all(
    parallelBodies.map((body) =>
      request<any>(`/patients/${parallelId}/measurements`, {
        method: "POST",
        body: JSON.stringify(body),
      })
    )
  );
  const parallelOk = parallelResults.every((r) => r.status === 201);
  const seqs = parallelResults.map((r) => r.body.sequenceNumber).sort((a, b) => a - b);
  const seqOk = JSON.stringify(seqs) === JSON.stringify([1, 2, 3, 4, 5]);
  log(
    "5 POST paralelos → sequence_number 1..5 sin unique error",
    parallelOk && seqOk,
    `seqs=[${seqs.join(",")}] statuses=[${parallelResults.map((r) => r.status).join(",")}]`
  );

  // Limpieza vía API (mediciones + comparisons) y luego pacientes vía service role
  for (const r of parallelResults) {
    if (r.body?.id) {
      await request(`/measurements/${r.body.id}`, { method: "DELETE" });
    }
  }
  if (m2.body?.id) {
    await request(`/measurements/${m2.body.id}`, { method: "DELETE" });
  }

  const sb = adminClient();
  const patientIds = [patientId, parallelId].filter(Boolean);
  const { error: delPatientsErr } = await sb.from("patients").delete().in("id", patientIds);
  log("borrar pacientes de prueba", !delPatientsErr, delPatientsErr?.message);

  const { data: leftoverPatients, error: leftPatErr } = await sb
    .from("patients")
    .select("id, full_name")
    .or(`full_name.ilike.%Smoke%,national_id.ilike.SMK%,national_id.ilike.SMP%`);
  const { count: measCount, error: leftMeasErr } = await sb
    .from("measurements")
    .select("id", { count: "exact", head: true });
  const { count: cmpCount, error: leftCmpErr } = await sb
    .from("comparisons")
    .select("id", { count: "exact", head: true });
  const { count: contrCount, error: leftContrErr } = await sb
    .from("measurement_contractions")
    .select("id", { count: "exact", head: true });

  const clean =
    !leftPatErr &&
    !leftMeasErr &&
    !leftCmpErr &&
    !leftContrErr &&
    (leftoverPatients?.length ?? 0) === 0 &&
    (measCount ?? 0) === 0 &&
    (cmpCount ?? 0) === 0 &&
    (contrCount ?? 0) === 0;

  log(
    "base sin datos de prueba",
    clean,
    `patients_smoke=${leftoverPatients?.length ?? "?"} measurements=${measCount} comparisons=${cmpCount} contractions=${contrCount}`
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\nResumen: ${results.length - failed.length}/${results.length} OK`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Smoke abortó:", err);
  process.exit(1);
});
