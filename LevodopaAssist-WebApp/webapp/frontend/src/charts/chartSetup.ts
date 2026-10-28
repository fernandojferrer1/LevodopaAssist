import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

const colorCache = new Map<string, string>();

/** Lee un color definido como custom property CSS (ej. --color-primary) para usarlo en canvas. */
export function themeColor(cssVar: string, fallback: string): string {
  const cached = colorCache.get(cssVar);
  if (cached) return cached;
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  const resolved = value || fallback;
  colorCache.set(cssVar, resolved);
  return resolved;
}
