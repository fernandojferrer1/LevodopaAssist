import type { Comparison, Measurement, Patient } from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status} en ${path}`);
  }

  return res.json() as Promise<T>;
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
  deleteMeasurement: (id: string) => request<{ ok: boolean }>(`/measurements/${id}`, { method: "DELETE" }),
  createMeasurement: (
    patientId: string,
    data: Omit<
      Measurement,
      | "id"
      | "patientId"
      | "sequenceNumber"
      | "createdAt"
      | "rawSamplesJson"
      | "contractions"
      // Métricas derivadas: las calcula el backend a partir de "contractions" y "rawSamples", el
      // cliente no las manda.
      | "amplitudeDecrementPct"
      | "durationDecrementPct"
      | "durationCvPct"
      | "peakToBaseRatio"
      | "iemg"
    > & {
      rawSamples?: number[];
      contractions: { amplitude: number; durationMs: number }[];
    }
  ) =>
    request<Measurement>(`/patients/${patientId}/measurements`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listComparisons: (patientId: string) =>
    request<Comparison[]>(`/patients/${patientId}/comparisons`),
  getComparison: (id: string) => request<Comparison>(`/comparisons/${id}`),
  createComparison: (patientId: string, measurementAId: string, measurementBId: string) =>
    request<Comparison>(`/patients/${patientId}/comparisons`, {
      method: "POST",
      body: JSON.stringify({ measurementAId, measurementBId }),
    }),
};
