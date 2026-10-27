import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, UnauthorizedError } from "../api/client";
import { LiveWaveformChart } from "../charts/LiveWaveformChart";
import { LiveIndicator } from "../components/LiveIndicator";
import { ReloginModal } from "../components/ReloginModal";
import {
  isWebSerialSupported,
  SerialMeasurementSession,
  type SessionStatus,
} from "../serial/SerialMeasurementSession";
import type { SummaryFields } from "../serial/parser";
import type { MedicationState, Patient } from "../types";

type WizardStep = "form" | "connecting" | "device" | "results" | "saving";

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function NewMeasurement() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [step, setStep] = useState<WizardStep>("form");
  const [medicationState, setMedicationState] = useState<MedicationState>("sin_levodopa");
  const [location, setLocation] = useState(() => localStorage.getItem("lastMeasurementLocation") ?? "");
  const [measuredAt, setMeasuredAt] = useState(() => toDatetimeLocal(new Date()));
  const [notes, setNotes] = useState("");

  const [deviceStatus, setDeviceStatus] = useState<SessionStatus>("idle");
  const [displaySamples, setDisplaySamples] = useState<number[]>([]);
  const [contractionCount, setContractionCount] = useState(0);
  const [summary, setSummary] = useState<SummaryFields | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [showRelogin, setShowRelogin] = useState(false);

  const sessionRef = useRef<SerialMeasurementSession | null>(null);
  const samplesRef = useRef<number[]>([]);
  const contractionsRef = useRef<{ amplitude: number; durationMs: number }[]>([]);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const webSerialOk = isWebSerialSupported();

  useEffect(() => {
    if (patientId) {
      api.getPatient(patientId).then(setPatient).catch(() => {});
    }
    return () => {
      stopFlushInterval();
      sessionRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startFlushInterval() {
    stopFlushInterval();
    flushIntervalRef.current = setInterval(() => {
      setDisplaySamples([...samplesRef.current]);
    }, 100);
  }

  function stopFlushInterval() {
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
  }

  async function handleStartMeasurement(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    samplesRef.current = [];
    contractionsRef.current = [];
    setDisplaySamples([]);
    setContractionCount(0);
    setSummary(null);
    setStalled(false);

    localStorage.setItem("lastMeasurementLocation", location);

    const session = new SerialMeasurementSession({
      onStatusChange: setDeviceStatus,
      onRawSample: (value) => {
        samplesRef.current.push(value);
      },
      onContractionDetail: (amplitude, durationMs) => {
        contractionsRef.current.push({ amplitude, durationMs });
        setContractionCount(contractionsRef.current.length);
      },
      onSummary: (fields) => {
        stopFlushInterval();
        setDisplaySamples([...samplesRef.current]);
        setSummary(fields);
        setStep("results");
      },
      onStalled: () => setStalled(true),
      onError: (message) => setErrorMessage(message),
    });
    sessionRef.current = session;

    setStep("connecting");
    try {
      await session.requestPort();
    } catch {
      // El usuario cerró el selector de puertos del navegador sin elegir uno.
      setStep("form");
      return;
    }

    setStep("device");
    try {
      await session.start();
      startFlushInterval();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo abrir el puerto serie.");
    }
  }

  async function handleCancel() {
    stopFlushInterval();
    await sessionRef.current?.cancel();
    setStep("form");
    setErrorMessage(null);
    setStalled(false);
  }

  async function persistMeasurement() {
    if (!patientId || !summary) return;
    const measurement = await api.createMeasurement(patientId, {
      medicationState,
      measuredAt: new Date(measuredAt).toISOString(),
      location: location || null,
      notes: notes || null,
      status: "completed",
      contractions: contractionsRef.current,
      rawSamples: samplesRef.current,
      ...summary,
    });
    await sessionRef.current?.close();
    navigate(`/patients/${patientId}/measurements/${measurement.id}`);
  }

  async function handleSave() {
    if (!patientId || !summary) return;
    setStep("saving");
    setShowRelogin(false);
    setErrorMessage(null);
    try {
      await persistMeasurement();
    } catch (err) {
      // samplesRef / summary / contractionsRef se conservan: no se descarta la medición.
      if (err instanceof UnauthorizedError) {
        setErrorMessage(
          "Tu sesión expiró al guardar. Los datos de la medición siguen en memoria: volvé a ingresar para reintentar."
        );
        setShowRelogin(true);
        setStep("results");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : "No se pudo guardar la medición.");
      setStep("results");
    }
  }

  async function handleReloginSuccess() {
    setShowRelogin(false);
    setErrorMessage(null);
    setStep("saving");
    try {
      await persistMeasurement();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setErrorMessage("Todavía no se pudo autenticar. Probá de nuevo.");
        setShowRelogin(true);
        setStep("results");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : "No se pudo guardar la medición.");
      setStep("results");
    }
  }

  async function handleDiscardResults() {
    await sessionRef.current?.close();
    setStep("form");
    setSummary(null);
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Pacientes</Link> /{" "}
        <Link to={`/patients/${patientId}`}>{patient?.fullName ?? "Paciente"}</Link> / Nueva medición
      </div>

      <div className="page-header">
        <div>
          <span className="eyebrow">Captura</span>
          <h1>Nueva medición</h1>
        </div>
      </div>

      {!webSerialOk && (
        <div className="banner banner-error">
          Este navegador no soporta Web Serial. Abrí esta página en Chrome o Edge de escritorio para poder
          conectar el ESP32.
        </div>
      )}

      {errorMessage && <div className="banner banner-error">{errorMessage}</div>}

      {step === "form" && (
        <div className="card">
          <form onSubmit={handleStartMeasurement}>
            <div className="field-row">
              <div className="field">
                <label>Estado de medicación</label>
                <select
                  value={medicationState}
                  onChange={(e) => setMedicationState(e.target.value as MedicationState)}
                >
                  <option value="sin_levodopa">Sin levodopa</option>
                  <option value="post_levodopa">Post-levodopa</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="measuredAt">Fecha y hora</label>
                <input
                  id="measuredAt"
                  type="datetime-local"
                  value={measuredAt}
                  onChange={(e) => setMeasuredAt(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="location">Lugar de evaluación</label>
              <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="notes">Observaciones (opcional)</label>
              <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <button type="submit" className="btn btn-primary" disabled={!webSerialOk}>
              Conectar dispositivo y comenzar
            </button>
          </form>
        </div>
      )}

      {step === "connecting" && (
        <div className="card">
          <p>Seleccioná el puerto del ESP32 en el diálogo del navegador...</p>
        </div>
      )}

      {step === "device" && (
        <>
          {(deviceStatus === "port_open" || deviceStatus === "listening") && (
            <div className="card banner-info" style={{ marginBottom: "var(--space-5)" }}>
              <strong>Presioná el botón de reset del ESP32 (o reconectá la alimentación)</strong> para iniciar
              la medición. El dispositivo tarda ~7s en estabilizarse y calibrar antes de empezar a graficarse
              la señal — es normal no ver nada en ese lapso.
            </div>
          )}

          {stalled && (
            <div className="banner banner-error">
              No llegó el resumen final del dispositivo en el tiempo esperado. La medición puede haberse
              interrumpido — podés cancelar y reintentar.
            </div>
          )}

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <h2>Señal en vivo</h2>
                <LiveIndicator status={stalled ? "stalled" : "live"} />
              </div>
              <span className="mono" style={{ color: "var(--color-text-muted)" }}>
                {displaySamples.length} muestras · {contractionCount} contracciones detectadas
              </span>
            </div>
            <LiveWaveformChart samples={displaySamples} />
          </div>

          <div style={{ marginTop: "var(--space-5)" }}>
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancelar medición
            </button>
          </div>
        </>
      )}

      {(step === "results" || step === "saving") && summary && (
        <div className="card">
          <h2 style={{ marginBottom: "var(--space-4)" }}>Resultados de la medición</h2>
          <div className="metric-grid">
            <MetricTile label="Contracciones" value={summary.conNum} />
            <MetricTile label="Contr. / min" value={summary.conXMinuto.toFixed(1)} />
            <MetricTile label="Pico máximo" value={`${summary.peakMax.toFixed(0)} mV`} />
            <MetricTile label="Promedio de picos" value={`${summary.promedioPeaks.toFixed(0)} mV`} />
            <MetricTile label="Valor base (reposo)" value={`${summary.yyn.toFixed(0)} mV`} />
            <MetricTile label="Duración prom. contracción" value={`${summary.promedioLthMs.toFixed(0)} ms`} />
            <MetricTile label="Tiempo prom. entre contracciones" value={`${summary.promedioBtwMs.toFixed(0)} ms`} />
            <MetricTile label="Umbral usado" value={`${summary.thresh.toFixed(0)} mV`} />
            <MetricTile label="Duración total" value={`${(summary.timerMedicionMs / 1000).toFixed(1)} s`} />
          </div>

          <div style={{ marginTop: "var(--space-5)" }}>
            <LiveWaveformChart samples={displaySamples} threshold={summary.thresh} />
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
            <button className="btn btn-secondary" onClick={handleDiscardResults} disabled={step === "saving"}>
              Descartar
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={step === "saving"}>
              {step === "saving" ? "Guardando..." : "Guardar medición"}
            </button>
          </div>
        </div>
      )}

      {showRelogin && (
        <ReloginModal
          message="Ingresá de nuevo para guardar la medición. Los datos capturados no se pierden."
          onSuccess={handleReloginSuccess}
          onCancel={() => setShowRelogin(false)}
        />
      )}
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
