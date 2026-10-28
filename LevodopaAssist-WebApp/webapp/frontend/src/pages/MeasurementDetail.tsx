import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { LiveWaveformChart } from "../charts/LiveWaveformChart";
import { MedicationBadge } from "../components/MedicationBadge";
import { downloadRawSignalCsv, downloadRawSignalJson } from "../lib/rawSignalExport";
import type { Measurement, Patient } from "../types";

export function MeasurementDetail() {
  const { patientId, measurementId } = useParams<{ patientId: string; measurementId: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!patientId || !measurementId) return;
    Promise.all([api.getPatient(patientId), api.getMeasurement(measurementId)])
      .then(([p, m]) => {
        setPatient(p);
        setMeasurement(m);
      })
      .catch((err) => setError(err.message));
  }, [patientId, measurementId]);

  async function handleDelete() {
    if (!patientId || !measurementId) return;
    const confirmed = window.confirm(
      "¿Eliminar esta medición? También se eliminarán las comparaciones que la incluyan. Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await api.deleteMeasurement(measurementId);
      navigate(`/patients/${patientId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la medición.");
      setDeleting(false);
    }
  }

  if (error && !measurement) return <div className="banner banner-error">{error}</div>;
  if (!patient || !measurement) return <p className="empty-state">Cargando...</p>;

  const rawSamples: number[] | null = measurement.rawSamplesJson
    ? JSON.parse(measurement.rawSamplesJson)
    : null;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Pacientes</Link> / <Link to={`/patients/${patient.id}`}>{patient.fullName}</Link> / Medición
      </div>

      <div className="page-header">
        <div>
          <span className="eyebrow">Medición N.° {measurement.sequenceNumber}</span>
          <h1>Medición del {new Date(measurement.measuredAt).toLocaleString()}</h1>
          <p className="page-header__subtitle">
            <MedicationBadge state={measurement.medicationState} />
            {measurement.location ? ` · ${measurement.location}` : ""}
          </p>
        </div>
        <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Eliminando..." : "Eliminar medición"}
        </button>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {measurement.notes && (
        <div className="card" style={{ marginBottom: "var(--space-5)" }}>
          <div className="metric-tile__label">Observaciones</div>
          <p style={{ marginTop: "var(--space-2)" }}>{measurement.notes}</p>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: "var(--space-4)" }}>Resultados</h2>
        <div className="metric-grid">
          <MetricTile label="Contracciones" value={measurement.conNum} />
          <MetricTile label="Contr. / min" value={measurement.conXMinuto.toFixed(1)} />
          <MetricTile label="Pico máximo" value={`${measurement.peakMax.toFixed(0)} mV`} />
          <MetricTile label="Promedio de picos" value={`${measurement.promedioPeaks.toFixed(0)} mV`} />
          <MetricTile label="Valor base (reposo)" value={`${measurement.yyn.toFixed(0)} mV`} />
          <MetricTile label="Duración prom. contracción" value={`${measurement.promedioLthMs.toFixed(0)} ms`} />
          <MetricTile label="Tiempo prom. entre contracciones" value={`${measurement.promedioBtwMs.toFixed(0)} ms`} />
          <MetricTile label="Umbral usado" value={`${measurement.thresh.toFixed(0)} mV`} />
          <MetricTile label="Duración total" value={`${(measurement.timerMedicionMs / 1000).toFixed(1)} s`} />
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: "var(--space-2)" }}>Métricas derivadas</h2>
        <p className="page-header__subtitle" style={{ marginBottom: "var(--space-4)" }}>
          Calculadas a partir de las contracciones detectadas y la señal registrada. Requieren al
          menos 2 contracciones (decremento y variabilidad) o la señal cruda guardada (iEMG).
        </p>
        <div className="metric-grid">
          <MetricTile
            label="Decremento de amplitud"
            value={formatPct(measurement.amplitudeDecrementPct)}
          />
          <MetricTile
            label="Decremento de duración"
            value={formatPct(measurement.durationDecrementPct)}
          />
          <MetricTile
            label="Variabilidad de duración (CV)"
            value={formatPct(measurement.durationCvPct)}
          />
          <MetricTile
            label="Relación pico / base"
            value={measurement.peakToBaseRatio == null ? "N/A" : measurement.peakToBaseRatio.toFixed(2)}
          />
          <MetricTile
            label="Actividad muscular total (iEMG)"
            value={measurement.iemg == null ? "N/A" : `${measurement.iemg.toFixed(0)} mV·ms`}
          />
        </div>
      </div>

      {rawSamples && rawSamples.length > 0 && (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-4)",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <h2>Señal registrada</h2>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                className="btn btn-secondary"
                onClick={() => downloadRawSignalCsv(patient.fullName, measurement, rawSamples)}
              >
                Exportar todo (CSV)
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => downloadRawSignalJson(patient.fullName, measurement, rawSamples)}
              >
                Exportar todo (JSON)
              </button>
            </div>
          </div>
          <LiveWaveformChart samples={rawSamples} threshold={measurement.thresh} />
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: "var(--space-4)" }}>Contracciones detectadas</h2>
        {!measurement.contractions || measurement.contractions.length === 0 ? (
          <p className="empty-state">No se detectaron contracciones en esta medición.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Amplitud (mV)</th>
                <th>Duración (ms)</th>
              </tr>
            </thead>
            <tbody>
              {measurement.contractions.map((c) => (
                <tr key={c.id} style={{ cursor: "default" }}>
                  <td className="num">{c.sequenceIndex + 1}</td>
                  <td className="num">{c.amplitude.toFixed(0)}</td>
                  <td className="num">{c.durationMs.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-tile">
      <div className="metric-tile__label">{label}</div>
      <div className="metric-tile__value">{value}</div>
    </div>
  );
}

function formatPct(value: number | null): string {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
