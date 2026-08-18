export default function Wordmark({
  kicker = "Team ledger",
}: {
  kicker?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[11px] font-bold lowercase tracking-[0.14em] text-primary">
        toco labs
      </div>
      <div className="text-sm font-semibold text-foreground">{kicker}</div>
    </div>
  );
}
