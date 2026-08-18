export default function MetricCard({
  label,
  value,
  hint,
  trend,
  icon,
  tone = "ink",
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: number | null;
  icon?: React.ReactNode;
  tone?: "ink" | "teal" | "warning" | "success" | "info";
}) {
  const tones = {
    ink: "bg-secondary text-secondary-foreground",
    teal: "bg-primary-soft text-accent",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    info: "bg-info-soft text-info",
  };

  return (
    <article className="tl-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}
          aria-hidden
        >
          {icon ?? <span className="text-sm font-semibold">•</span>}
        </div>
        {typeof trend === "number" ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
              trend >= 0 ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
            }`}
          >
            {trend >= 0 ? "+" : ""}
            {trend.toFixed(0)}%
          </span>
        ) : null}
      </div>
      <div className="mt-4 break-words text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight break-words text-foreground tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</div> : null}
    </article>
  );
}

export function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 19a5 5 0 0 1 10 0" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function RevenueIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 16h14M7 16V8m5 8V6m5 10v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PendingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function DeliveredIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 12.5 9.5 17 19 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
