import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ComparisonDeltaChart } from "../charts/ComparisonDeltaChart";
import { MedicationBadge } from "../components/MedicationBadge";
import { COMPARISON_METRIC_KEYS, METRIC_LABELS, type Comparison, type Patient } from "../types";

export function ComparisonDetail() {
  const { patientId, comparisonId } = useParams<{ patientId: string; comparisonId: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId || !comparisonId) return;
    Promise.all([api.getPatient(patientId), api.getComparison(comparisonId)])
      .then(([p, c]) => {
        setPatient(p);
        setComparison(c);
      })
      .catch((err) => setError(err.message));
  }, [patientId, comparisonId]);

  if (error) return <div className="banner banner-error">{error}</div>;
  if (!patient || !comparison) return <p className="empty-state">Cargando...</p>;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Pacientes</Link> / <Link to={`/patients/${patient.id}`}>{patient.fullName}</Link> / Comparación
      </div>

      <div className="page-header">
        <div>
          <span className="eyebrow">Comparación</span>
          <h1>Comparación de mediciones</h1>
          <p className="page-header__subtitle">
            A: {new Date(comparison.measurementA.measuredAt).toLocaleString()}{" "}
            <MedicationBadge state={comparison.measurementA.medicationState} /> → B:{" "}
            {new Date(comparison.measurementB.measuredAt).toLocaleString()}{" "}
            <MedicationBadge state={comparison.measurementB.medicationState} />
          </p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: "var(--space-4)" }}>% de variación por variable</h2>
        <ComparisonDeltaChart metrics={comparison.metrics} />
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Variable</th>
              <th className="num">Medición A</th>
              <th className="num">Medición B</th>
              <th className="num">Variación</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_METRIC_KEYS.map((key) => {
              const m = comparison.metrics[key];
              return (
                <tr key={key} style={{ cursor: "default" }}>
                  <td>{METRIC_LABELS[key]}</td>
                  <td className="num">{m.a == null ? "N/A" : m.a.toFixed(1)}</td>
                  <td className="num">{m.b == null ? "N/A" : m.b.toFixed(1)}</td>
                  <td className="num">
                    {m.pctChange == null ? "N/A" : `${m.pctChange >= 0 ? "+" : ""}${m.pctChange.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
