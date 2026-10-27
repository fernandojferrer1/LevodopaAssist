import "./chartSetup";
import { Doughnut } from "react-chartjs-2";
import { themeColor } from "./chartSetup";
import {
  COMPARISON_METRIC_KEYS,
  METRIC_LABELS,
  type ComparisonMetrics,
  type MetricComparison,
} from "../types";

interface Props {
  metrics: ComparisonMetrics;
}

/** Grilla de gráficos de torta: uno por métrica, mostrando la proporción A/B y el % de variación al centro. */
export function ComparisonDeltaChart({ metrics }: Props) {
  const colorBase = themeColor("--color-border-strong", "rgba(255, 255, 255, 0.18)");
  const colorUp = themeColor("--color-primary", "#3fb0c4");
  const colorDown = themeColor("--color-teal", "#2dd4bf");

  return (
    <>
      <div className="donut-legend">
        <span className="donut-legend__item">
          <span className="donut-legend__dot" style={{ background: colorBase }} /> Medición A
        </span>
        <span className="donut-legend__item">
          <span className="donut-legend__dot" style={{ background: colorUp }} /> Medición B (aumentó)
        </span>
        <span className="donut-legend__item">
          <span className="donut-legend__dot" style={{ background: colorDown }} /> Medición B (disminuyó)
        </span>
      </div>
      <div className="donut-grid">
        {COMPARISON_METRIC_KEYS.map((key) => (
          <MetricDonut
            key={key}
            label={METRIC_LABELS[key]}
            metric={metrics[key]}
            colorBase={colorBase}
            colorUp={colorUp}
            colorDown={colorDown}
          />
        ))}
      </div>
    </>
  );
}

function MetricDonut({
  label,
  metric,
  colorBase,
  colorUp,
  colorDown,
}: {
  label: string;
  metric: MetricComparison;
  colorBase: string;
  colorUp: string;
  colorDown: string;
}) {
  const { a, b, pctChange } = metric;
  const sliceColor = pctChange != null && pctChange < 0 ? colorDown : colorUp;
  const magA = a == null ? 0 : Math.abs(a);
  const magB = b == null ? 0 : Math.abs(b);
  const hasData = a != null && b != null && magA + magB > 0;

  return (
    <div className="donut-tile">
      <div className="donut-tile__label">{label}</div>
      <div className="donut-tile__chart">
        <Doughnut
          data={{
            labels: ["Medición A", "Medición B"],
            datasets: [
              {
                data: hasData ? [magA, magB] : [1, 1],
                backgroundColor: hasData ? [colorBase, sliceColor] : [colorBase, colorBase],
                borderWidth: 0,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            cutout: "72%",
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label}: ${(ctx.raw as number).toFixed(1)}`,
                },
              },
            },
          }}
        />
        <div className="donut-tile__center">
          <span className="donut-tile__pct" style={{ color: sliceColor }}>
            {pctChange == null ? "N/A" : `${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}%`}
          </span>
        </div>
      </div>
      <div className="donut-tile__values">
        {a == null ? "N/A" : a.toFixed(1)} → {b == null ? "N/A" : b.toFixed(1)}
      </div>
    </div>
  );
}
