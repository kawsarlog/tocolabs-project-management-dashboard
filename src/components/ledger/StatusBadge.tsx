const toneMap: Record<string, string> = {
  assigned: "bg-info-soft text-info ring-border",
  pending: "bg-warning-soft text-warning ring-border",
  complete: "bg-success-soft text-success ring-border",
  delivered: "bg-primary-soft text-accent ring-border",
  important: "bg-destructive-soft text-destructive ring-border",
  "no order": "bg-muted text-muted-foreground ring-border",
};

export default function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">-</span>;

  const key = status.trim().toLowerCase();
  const tone = toneMap[key] ?? "bg-muted text-muted-foreground ring-border";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {status}
    </span>
  );
}
