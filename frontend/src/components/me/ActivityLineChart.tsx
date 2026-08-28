"use client";

type ActivityLineChartProps = {
  values: number[];
  className?: string;
};

export function ActivityLineChart({ values, className }: ActivityLineChartProps) {
  const data = values.length > 0 ? values : Array(10).fill(0);
  const max = Math.max(1, ...data);
  const width = 240;
  const height = 72;
  const padX = 4;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = data.map((v, i) => {
    const x = padX + (i / Math.max(1, data.length - 1)) * innerW;
    const y = padY + innerH - (v / max) * innerH;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? "me-chart-line"}
      aria-hidden
    >
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1={padX}
          x2={width - padX}
          y1={padY + innerH * ratio}
          y2={padY + innerH * ratio}
          stroke="var(--color-line)"
          strokeOpacity={0.35}
          strokeWidth={1}
        />
      ))}
      <polyline
        fill="none"
        stroke="var(--color-magenta)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
    </svg>
  );
}
