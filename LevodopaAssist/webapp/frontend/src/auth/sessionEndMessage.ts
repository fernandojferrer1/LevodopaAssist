const KEY = "la_session_end_message";

/** Guarda el motivo de cierre para mostrarlo en /login (sobrevive al redirect de RequireAuth). */
export function setSessionEndMessage(message: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, message);
}

export function getSessionEndMessage(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(KEY);
}

export function clearSessionEndMessage(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
