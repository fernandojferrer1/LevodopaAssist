import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { getSessionEndMessage } from "./sessionEndMessage";

export function RequireAuth() {
  const { session, loading, configError } = useAuth();
  const location = useLocation();

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

  if (!session) {
    const message = getSessionEndMessage() ?? undefined;
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search, message }}
      />
    );
  }

  return <Outlet />;
}

