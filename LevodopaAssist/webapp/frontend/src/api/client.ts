import type { Comparison, Measurement, Patient } from "../types";
import { supabase } from "../auth/supabase";

export class UnauthorizedError extends Error {
  constructor(message = "Tu sesión expiró, ingresá de nuevo") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { skipAuthRedirect?: boolean }
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = await getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`/api${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    if (!options?.skipAuthRedirect) {
      unauthorizedHandler?.();
    }
    throw new UnauthorizedError();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Error ${res.status} en ${path}`);
  }

  return res.json() as Promise<T>;
}

type CreateMeasurementBody = Omit<
  Measurement,
  | "id"
  | "patientId"
  | "sequenceNumber"
  | "createdAt"
  | "rawSamplesJson"
  | "contractions"
  | "amplitudeDecrementPct"
  | "durationDecrementPct"
  | "durationCvPct"
  | "peakToBaseRatio"
  | "iemg"
> & {
  rawSamples?: number[];
  contractions: { amplitude: number; durationMs: number }[];
};

async function createMeasurementWithAuthRetry(
  patientId: string,
  data: CreateMeasurementBody
): Promise<Measurement> {
  const path = `/patients/${patientId}/measurements`;
  const init: RequestInit = { method: "POST", body: JSON.stringify(data) };

  try {
    return await request<Measurement>(path, init, { skipAuthRedirect: true });
  } catch (err) {
    if (!(err instanceof UnauthorizedError) || !supabase) throw err;

    // Intento 1 tras 401: refrescar sesión y reintentar una vez (no descartar la medición).
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session) {
      throw err;
    }
    return await request<Measurement>(path, init, { skipAuthRedirect: true });
  }
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  listPatients: (q?: string) =>
    request<Patient[]>(`/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getPatient: (id: string) => request<Patient>(`/patients/${id}`),
  createPatient: (data: Partial<Patient>) =>
    request<Patient>("/patients", { method: "POST", body: JSON.stringify(data) }),
  updatePatient: (id: string, data: Partial<Patient>) =>
    request<Patient>(`/patients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listMeasurements: (patientId: string) =>
    request<Measurement[]>(`/patients/${patientId}/measurements`),
  getMeasurement: (id: string) => request<Measurement>(`/measurements/${id}`),
  deleteMeasurement: (id: string) =>
    request<{ ok: boolean }>(`/measurements/${id}`, { method: "DELETE" }),
  createMeasurement: (patientId: string, data: CreateMeasurementBody) =>
    createMeasurementWithAuthRetry(patientId, data),

  listComparisons: (patientId: string) =>
    request<Comparison[]>(`/patients/${patientId}/comparisons`),
  getComparison: (id: string) => request<Comparison>(`/comparisons/${id}`),
  createComparison: (patientId: string, measurementAId: string, measurementBId: string) =>
    request<Comparison>(`/patients/${patientId}/comparisons`, {
      method: "POST",
      body: JSON.stringify({ measurementAId, measurementBId }),
    }),
};
