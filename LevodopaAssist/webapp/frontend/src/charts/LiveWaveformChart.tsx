import "./chartSetup";
import { Line } from "react-chartjs-2";
import type { ScriptableContext } from "chart.js";
import { themeColor } from "./chartSetup";

interface Props {
  samples: number[];
  threshold?: number | null;
  heightPx?: number;
}

function waveformGradient(context: ScriptableContext<"line">) {
  const { chart } = context;
  const { ctx, chartArea } = chart;
  if (!chartArea) return "rgba(63, 176, 196, 0.07)";
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, "rgba(63, 176, 196, 0.12)");
  gradient.addColorStop(1, "rgba(63, 176, 196, 0.01)");
  return gradient;
}

export function LiveWaveformChart({ samples, threshold, heightPx = 320 }: Props) {
  const labels = samples.map((_, i) => i);

  return (
    <div style={{ height: heightPx, filter: "drop-shadow(0 0 3px var(--color-primary-glow))" }}>
      <Line
        data={{
          labels,
          datasets: [
            {
              label: "Señal EMG (mV)",
              data: samples,
              borderColor: themeColor("--color-primary", "#3fb0c4"),
              backgroundColor: waveformGradient,
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.15,
              fill: true,
              ...(threshold != null && { order: 2 }),
            },
            ...(threshold != null
              ? [
                  {
                    label: `Umbral (${threshold.toFixed(0)} mV)`,
                    data: samples.map(() => threshold),
                    borderColor: themeColor("--color-warning", "#fbbf24"),
                    borderDash: [6, 4],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    order: 1,
                  },
                ]
              : []),
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              position: "top",
              labels: { boxWidth: 12, font: { family: "IBM Plex Sans", size: 12, weight: 500 } },
            },
            tooltip: { enabled: false },
          },
          scales: {
            x: { display: false },
            y: {
              title: { display: true, text: "mV" },
              grid: { color: themeColor("--color-border", "#2a2d33") },
              border: { display: false },
              ticks: { font: { family: "IBM Plex Mono", size: 11 } },
            },
          },
        }}
      />
    </div>
  );
}
