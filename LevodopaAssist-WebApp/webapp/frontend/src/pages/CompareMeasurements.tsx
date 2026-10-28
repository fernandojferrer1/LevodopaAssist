import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { MedicationBadge } from "../components/MedicationBadge";
import type { Measurement, Patient } from "../types";

export function CompareMeasurements() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    Promise.all([api.getPatient(patientId), api.listMeasurements(patientId)])
      .then(([p, m]) => {
        setPatient(p);
        setMeasurements(m);
      })
      .catch((err) => setError(err.message));
  }, [patientId]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length === 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  async function handleCompare() {
    if (!patientId || selected.length !== 2) return;
    setSaving(true);
    setError(null);
    try {
      // El orden importa: A = medición más antigua, B = más reciente, para leer el % de variación como "cambio en el tiempo".
      const [a, b] = [...selected].sort((x, y) => {
        const mx = measurements!.find((m) => m.id === x)!;
        const my = measurements!.find((m) => m.id === y)!;
        return new Date(mx.measuredAt).getTime() - new Date(my.measuredAt).getTime();
      });
      const comparison = await api.createComparison(patientId, a, b);
      navigate(`/patients/${patientId}/comparisons/${comparison.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la comparación.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !measurements) return <div className="banner banner-error">{error}</div>;
  if (!patient || !measurements) return <p className="empty-state">Cargando...</p>;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Pacientes</Link> / <Link to={`/patients/${patient.id}`}>{patient.fullName}</Link> / Comparar
        mediciones
      </div>

      <div className="page-header">
        <div>
          <span className="eyebrow">Selección</span>
          <h1>Comparar mediciones</h1>
          <p className="page-header__subtitle">Elegí exactamente dos mediciones para ver el % de variación entre ellas.</p>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="card">
        <div className="checkbox-list">
          {measurements.map((m) => {
            const isSelected = selected.includes(m.id);
            return (
              <label key={m.id} className={`checkbox-row ${isSelected ? "selected" : ""}`}>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(m.id)} />
                <div style={{ flex: 1 }}>
                  <strong>
                    N.° {m.sequenceNumber} — {new Date(m.measuredAt).toLocaleString()}
                  </strong>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: 2 }}>
                    {m.conNum} contracciones · {m.conXMinuto.toFixed(1)} contr./min
                    {m.location ? ` · ${m.location}` : ""}
                  </div>
                </div>
                <MedicationBadge state={m.medicationState} />
              </label>
            );
          })}
        </div>

        <div style={{ marginTop: "var(--space-5)" }}>
          <button className="btn btn-primary" disabled={selected.length !== 2 || saving} onClick={handleCompare}>
            {saving ? "Comparando..." : `Comparar (${selected.length}/2 seleccionadas)`}
          </button>
        </div>
      </div>
    </>
  );
}
