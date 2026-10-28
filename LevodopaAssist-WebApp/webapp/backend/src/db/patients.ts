import { supabase } from "./supabase";
import { mapPatient } from "./mappers";
import type { Patient, PatientRow } from "./types";

/** Escapa metacaracteres de ilike y de filtros .or() de PostgREST. */
export function escapeSearchTerm(q: string): string {
  return q
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export class UniqueViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UniqueViolationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export async function listPatients(q?: string): Promise<Patient[]> {
  let query = supabase.from("patients").select("*").order("full_name", { ascending: true });

  if (q) {
    const escaped = escapeSearchTerm(q);
    // PostgREST: comillas dobles si el patrón tiene espacios u otros chars.
    const pattern = `"%${escaped}%"`;
    query = query.or(
      `full_name.ilike.${pattern},national_id.ilike.${pattern},diagnosis.ilike.${pattern}`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as PatientRow[]).map(mapPatient);
}

export async function getPatient(id: string): Promise<Patient | null> {
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapPatient(data as PatientRow) : null;
}

export async function createPatient(input: {
  fullName: string;
  age: number;
  nationalId: string | null;
  diagnosis: string | null;
  notes: string | null;
  extraFields: string | null;
}): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .insert({
      full_name: input.fullName,
      age: input.age,
      national_id: input.nationalId,
      diagnosis: input.diagnosis,
      notes: input.notes,
      extra_fields: input.extraFields,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new UniqueViolationError("Ya existe un paciente con ese DNI");
    }
    throw error;
  }
  return mapPatient(data as PatientRow);
}

export async function updatePatient(
  id: string,
  input: {
    fullName?: string;
    age?: number;
    nationalId?: string | null;
    diagnosis?: string | null;
    notes?: string | null;
    extraFields?: string | null;
  }
): Promise<Patient> {
  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.age !== undefined) patch.age = input.age;
  if (input.nationalId !== undefined) patch.national_id = input.nationalId;
  if (input.diagnosis !== undefined) patch.diagnosis = input.diagnosis;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.extraFields !== undefined) patch.extra_fields = input.extraFields;

  const { data, error } = await supabase
    .from("patients")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new UniqueViolationError("Ya existe un paciente con ese DNI");
    }
    throw error;
  }
  if (!data) {
    throw new NotFoundError("Paciente no encontrado");
  }
  return mapPatient(data as PatientRow);
}

export async function deletePatient(id: string): Promise<void> {
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) throw error;
}

export async function pingDatabase(): Promise<boolean> {
  const { error } = await supabase.from("patients").select("id").limit(1);
  if (error) {
    console.error("Supabase health check failed:", error.message, error.code);
    return false;
  }
  return true;
}
