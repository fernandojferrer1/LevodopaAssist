import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-header__brand">
          <span className="app-header__dot" />
          LevodopaAssist
        </Link>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
