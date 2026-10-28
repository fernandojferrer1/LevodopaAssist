/**
 * Indica si NewMeasurement tiene una captura en curso o resultados sin guardar.
 * Mientras sea true, el timeout de inactividad no cierra la sesión.
 */
let busy = false;
const listeners = new Set<() => void>();

export function setMeasurementBusy(next: boolean): void {
  if (busy === next) return;
  busy = next;
  listeners.forEach((fn) => fn());
}

export function isMeasurementBusy(): boolean {
  return busy;
}

export function onMeasurementBusyChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
