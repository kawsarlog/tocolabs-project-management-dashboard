export default function WorkspaceMark({
  name,
  logoUrl,
  size = "md",
  onDark = false,
}: {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
}) {
  const dim =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const text = size === "sm" ? "text-[11px]" : size === "lg" ? "text-lg" : "text-sm";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (logoUrl) {
    return (
      // User-uploaded brand mark; company name is rendered beside it.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={`${dim} shrink-0 rounded-lg object-cover ${onDark ? "bg-white/10" : "bg-muted"}`}
      />
    );
  }

  return (
    <div
      className={`${dim} ${text} flex shrink-0 items-center justify-center rounded-lg font-semibold ${
        onDark ? "bg-white/10 text-white" : "bg-secondary text-secondary-foreground"
      }`}
      aria-hidden
    >
      {initials || "W"}
    </div>
  );
}
