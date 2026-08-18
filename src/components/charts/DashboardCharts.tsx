"use client";

import { formatUsd } from "@/lib/money";

const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export default function HorizontalBars({
  items,
  emptyLabel = "No activity in this period.",
}: {
  items: Array<{ id: string; label: string; value: number; hint?: string }>;
  emptyLabel?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);

  if (!items.length) {
    return <EmptyChart message={emptyLabel} />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const width = max > 0 ? Math.max((item.value / max) * 100, item.value > 0 ? 6 : 0) : 0;
        return (
          <div key={item.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <div className="truncate text-sm font-medium text-foreground">{item.label}</div>
              <div className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatUsd(item.value)}
                {item.hint ? <span className="ml-2 text-xs">{item.hint}</span> : null}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${width}%`, background: palette[index % palette.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AreaChart({
  items,
  emptyLabel = "No daily activity yet.",
}: {
  items: Array<{ date: string; revenue: number; rows: number }>;
  emptyLabel?: string;
}) {
  if (!items.length) return <EmptyChart message={emptyLabel} />;

  const width = 640;
  const height = 220;
  const padX = 12;
  const padY = 16;
  const max = Math.max(...items.map((item) => item.revenue), 1);
  const points = items.map((item, index) => {
    const x = items.length === 1 ? width / 2 : padX + (index / (items.length - 1)) * (width - padX * 2);
    const y = height - padY - (item.revenue / max) * (height - padY * 2);
    return { ...item, x, y };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${points[points.length - 1].x},${height - padY} L${points[0].x},${height - padY} Z`;
  const labels = points.filter((_, index) => {
    if (points.length <= 8) return true;
    const step = Math.ceil(points.length / 6);
    return index % step === 0 || index === points.length - 1;
  });

  return (
    <div className="min-h-[180px] overflow-hidden sm:min-h-[220px]">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full overflow-hidden sm:h-[220px]" role="img">
        <title>Revenue trend</title>
        <defs>
          <linearGradient id="tl-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((lineY) => (
          <line
            key={lineY}
            x1={padX}
            x2={width - padX}
            y1={padY + (height - padY * 2) * lineY}
            y2={padY + (height - padY * 2) * lineY}
            stroke="currentColor"
            className="text-border"
            strokeDasharray="4 6"
          />
        ))}
        <path d={area} fill="url(#tl-area)" />
        <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2.4" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="3.2" fill="var(--card)" stroke="var(--chart-1)" strokeWidth="2">
              <title>{`${point.date}: $${point.revenue.toFixed(2)} · ${point.rows} rows`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between gap-1 overflow-hidden px-1 text-[11px] tabular-nums text-muted-foreground">
        {labels.map((point) => (
          <span key={point.date} className="min-w-0 truncate">
            {formatAxis(point.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  items,
  emptyLabel = "No status mix yet.",
}: {
  items: Array<{ status: string; count: number }>;
  emptyLabel?: string;
}) {
  if (!items.length) return <EmptyChart message={emptyLabel} />;

  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img">
        <title>Status mix</title>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--muted)" strokeWidth="14" />
        {items.map((item, index) => {
          const length = (item.count / total) * circumference;
          const circle = (
            <circle
              key={item.status}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={palette[index % palette.length]}
              strokeWidth="14"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 70 70)"
            >
              <title>{`${item.status}: ${item.count}`}</title>
            </circle>
          );
          offset += length;
          return circle;
        })}
        <text x="70" y="66" textAnchor="middle" className="fill-foreground text-[18px] font-semibold">
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" className="fill-[var(--muted-foreground)] text-[10px]">
          rows
        </text>
      </svg>
      <ul className="w-full space-y-2">
        {items.map((item, index) => (
          <li key={item.status} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: palette[index % palette.length] }}
              />
              <span className="truncate text-foreground">{item.status}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">
              {item.count} · {Math.round((item.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-lg bg-muted px-4 text-center text-sm leading-6 text-muted-foreground">
      {message}
    </div>
  );
}

function formatAxis(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-");
    return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("en-GB", {
      month: "short",
      timeZone: "UTC",
    });
  }
  return value.slice(8, 10) || value.slice(5);
}
