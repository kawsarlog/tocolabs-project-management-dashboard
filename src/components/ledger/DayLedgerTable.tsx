import StatusBadge from "@/components/ledger/StatusBadge";

type Entry = {
  id: string;
  rowOrder: number;
  orderId: string | null;
  client: string | null;
  orderValueUsd: number | null;
  newClients: number | null;
  status: string | null;
  notes: string | null;
  extra: string | null;
};

type Comment = {
  id: string;
  body: string;
  createdAt: Date;
  adminUser: { username: string };
};

export default function DayLedgerTable({
  title,
  date,
  shiftLabel,
  entries,
  comments,
  children,
}: {
  title?: string;
  date: Date;
  shiftLabel?: string | null;
  entries: Entry[];
  comments?: Comment[];
  children?: React.ReactNode;
}) {
  return (
    <section className="tl-card">
      <div className="border-b border-border px-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{title ?? "Work day"}</div>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {date.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {shiftLabel ? (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                {shiftLabel}
              </span>
            ) : null}
            {children}
          </div>
        </div>
      </div>

      <div className="tl-table-scroll">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Order ID</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Order Value ($)</th>
              <th className="px-4 py-3 font-medium">New Clients</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.length ? (
              entries.map((entry) => (
                <tr key={entry.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-foreground">{entry.orderId ?? "-"}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{entry.client ?? "-"}</td>
                  <td className="px-4 py-3 text-foreground">
                    {entry.orderValueUsd != null ? `$${entry.orderValueUsd}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-foreground">{entry.newClients ?? "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {entry.notes || entry.extra || "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No rows for this day yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {comments?.length ? (
        <div className="border-t border-border px-4 py-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Admin notes</div>
          <div className="space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
                <div className="font-medium text-foreground">{comment.adminUser.username}</div>
                <div className="mt-1 text-muted-foreground">{comment.body}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
