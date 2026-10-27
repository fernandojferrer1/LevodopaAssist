import type { MedicationState } from "../types";

export function MedicationBadge({ state }: { state: MedicationState }) {
  if (state === "sin_levodopa") {
    return <span className="badge badge-medication-off">Sin levodopa</span>;
  }
  return <span className="badge badge-medication-on">Post-levodopa</span>;
}
