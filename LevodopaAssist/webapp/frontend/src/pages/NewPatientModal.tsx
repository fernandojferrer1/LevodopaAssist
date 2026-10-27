import { useState } from "react";
import { api } from "../api/client";
import type { Patient } from "../types";

interface Props {
  onClose: () => void;
  onCreated: (patient: Patient) => void;
}

export function NewPatientModal({ onClose, onCreated }: Props) {
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const ageNum = Number(age);
    if (!fullName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!age || Number.isNaN(ageNum) || ageNum < 0) {
      setError("Ingresá una edad válida.");
      return;
    }

    setSaving(true);
    try {
      const patient = await api.createPatient({
        fullName: fullName.trim(),
        age: ageNum,
        nationalId: nationalId.trim() || null,
        diagnosis: diagnosis.trim() || null,
        notes: notes.trim() || null,
      });
      onCreated(patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el paciente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: "var(--space-4)" }}>Nuevo paciente</h2>

        {error && <div className="banner banner-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="fullName">Nombre completo</label>
            <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="age">Edad</label>
              <input id="age" type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="nationalId">DNI (opcional)</label>
              <input id="nationalId" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="diagnosis">Diagnóstico</label>
            <input id="diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="notes">Observaciones</label>
            <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", marginTop: "var(--space-5)" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando..." : "Crear paciente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
