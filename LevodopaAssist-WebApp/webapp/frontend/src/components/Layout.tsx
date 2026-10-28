import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-header__brand">
          <span className="app-header__dot" />
          LevodopaAssist
        </Link>
        {user && (
          <div className="app-header__user">
            <span className="app-header__email">{user.email}</span>
            <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
