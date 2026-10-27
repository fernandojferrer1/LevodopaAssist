import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Patient } from "../types";
import { NewPatientModal } from "./NewPatientModal";

export function PatientList() {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function reload(q?: string) {
    api
      .listPatients(q)
      .then(setPatients)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => reload(query), 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Registro</span>
          <h1>Pacientes</h1>
          <p className="page-header__subtitle">
            Seleccioná un paciente para ver su historial de mediciones o cargá uno nuevo.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nuevo paciente
        </button>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="card">
        <div className="field" style={{ marginBottom: "var(--space-4)" }}>
          <input
            placeholder="Buscar por nombre, DNI o diagnóstico..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {patients === null ? (
          <p className="empty-state">Cargando pacientes...</p>
        ) : patients.length === 0 ? (
          <p className="empty-state">
            Todavía no hay pacientes cargados. Usá "Nuevo paciente" para agregar el primero.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Edad</th>
                <th>DNI</th>
                <th>Diagnóstico</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/patients/${p.id}`)}>
                  <td>{p.fullName}</td>
                  <td className="num">{p.age}</td>
                  <td className="num">{p.nationalId ?? "—"}</td>
                  <td>{p.diagnosis ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <NewPatientModal
          onClose={() => setShowModal(false)}
          onCreated={(patient) => {
            setShowModal(false);
            navigate(`/patients/${patient.id}`);
          }}
        />
      )}
    </>
  );
}
