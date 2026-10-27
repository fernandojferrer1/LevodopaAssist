import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { clearSessionEndMessage, getSessionEndMessage } from "../auth/sessionEndMessage";

export function Login() {
  const { session, loading, configError, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string; message?: string } | null)?.from ?? "/";
  const stateMessage = (location.state as { message?: string } | null)?.message;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => stateMessage ?? getSessionEndMessage());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const message = stateMessage ?? getSessionEndMessage();
    if (message) setError(message);
  }, [stateMessage]);



  if (configError) {
    return (
      <div className="app-main">
        <div className="banner banner-error">{configError}</div>
      </div>
    );
  }

  if (loading) {
    return <p className="empty-state">Cargando...</p>;
  }

  if (session) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      clearSessionEndMessage();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email o contraseña incorrectos");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-main" style={{ maxWidth: 420 }}>
      <div className="page-header">
        <div>
          <span className="eyebrow">Acceso</span>
          <h1>Ingresar</h1>
          <p className="page-header__subtitle">Usá la cuenta que te asignaron. No hay registro público.</p>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: "var(--space-4)" }}>
            {submitting ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
