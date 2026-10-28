import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { MedicationBadge } from "../components/MedicationBadge";
import type { Comparison, Measurement, Patient } from "../types";

export function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[] | null>(null);
  const [comparisons, setComparisons] = useState<Comparison[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    Promise.all([api.getPatient(patientId), api.listMeasurements(patientId), api.listComparisons(patientId)])
      .then(([p, m, c]) => {
        setPatient(p);
        setMeasurements(m);
        setComparisons(c);
      })
      .catch((err) => setError(err.message));
  }, [patientId]);

  if (error) {
    return <div className="banner banner-error">{error}</div>;
  }

  if (!patient) {
    return <p className="empty-state">Cargando paciente...</p>;
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Pacientes</Link> / {patient.fullName}
      </div>

      <div className="page-header">
        <div>
          <span className="eyebrow">Paciente</span>
          <h1>{patient.fullName}</h1>
          <p className="page-header__subtitle">
            {patient.age} años{patient.nationalId ? ` · DNI ${patient.nationalId}` : ""}
            {patient.diagnosis ? ` · ${patient.diagnosis}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/patients/${patient.id}/compare`)}
            disabled={!measurements || measurements.length < 2}
          >
            Comparar mediciones
          </button>
          <button className="btn btn-primary" onClick={() => navigate(`/patients/${patient.id}/measurements/new`)}>
            + Nueva medición
          </button>
        </div>
      </div>

      {patient.notes && (
        <div className="card" style={{ marginBottom: "var(--space-5)" }}>
          <div className="metric-tile__label">Observaciones</div>
          <p style={{ marginTop: "var(--space-2)" }}>{patient.notes}</p>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: "var(--space-4)" }}>Historial de mediciones</h2>
        {measurements === null ? (
          <p className="empty-state">Cargando...</p>
        ) : measurements.length === 0 ? (
          <p className="empty-state">
            Todavía no hay mediciones para este paciente. Usá "Nueva medición" para registrar la primera.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>N.°</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Lugar</th>
                <th>Contracciones</th>
                <th>Contr./min</th>
              </tr>
            </thead>
            <tbody>
              {measurements.map((m) => (
                <tr key={m.id} onClick={() => navigate(`/patients/${patient.id}/measurements/${m.id}`)}>
                  <td className="num">{m.sequenceNumber}</td>
                  <td>{new Date(m.measuredAt).toLocaleString()}</td>
                  <td>
                    <MedicationBadge state={m.medicationState} />
                  </td>
                  <td>{m.location ?? "—"}</td>
                  <td className="num">{m.conNum}</td>
                  <td className="num">{m.conXMinuto.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: "var(--space-4)" }}>Historial de comparaciones</h2>
        {comparisons === null ? (
          <p className="empty-state">Cargando...</p>
        ) : comparisons.length === 0 ? (
          <p className="empty-state">Todavía no se hicieron comparaciones para este paciente.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha de comparación</th>
                <th>Medición A</th>
                <th>Medición B</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/patients/${patient.id}/comparisons/${c.id}`)}>
                  <td>{new Date(c.createdAt).toLocaleString()}</td>
                  <td>{new Date(c.measurementA.measuredAt).toLocaleDateString()}</td>
                  <td>{new Date(c.measurementB.measuredAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
