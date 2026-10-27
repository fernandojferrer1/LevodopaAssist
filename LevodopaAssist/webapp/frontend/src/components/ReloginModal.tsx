import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";

/** Login embebido: no navega; al éxito llama onSuccess (p. ej. reintentar guardado). */
export function ReloginModal({
  message,
  onSuccess,
  onCancel,
}: {
  message: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email o contraseña incorrectos");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal card">
        <h2 style={{ marginBottom: "var(--space-2)" }}>Sesión expirada</h2>
        <p className="page-header__subtitle" style={{ marginBottom: "var(--space-4)" }}>
          {message}
        </p>
        {error && <div className="banner banner-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="relogin-email">Email</label>
            <input
              id="relogin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="relogin-password">Contraseña</label>
            <input
              id="relogin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Ingresando..." : "Ingresar y reintentar"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={submitting}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
