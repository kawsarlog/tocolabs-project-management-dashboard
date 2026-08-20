"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/ledger/StatusBadge";
import { OrderDeleteDialog, OrderViewDialog } from "@/components/sheet/OrderDialogs";
import { compactDate, SHEET_STATUSES } from "@/lib/sheet";

export type SheetEntry = {
  id: string;
  rowOrder: number;
  orderId: string | null;
  client: string | null;
  orderValueUsd: number | null;
  newClients: number | null;
  status: string | null;
  notes: string | null;
  extra: string | null;
  endDate: string | null;
};

export type SheetGroup = {
  workDayId: string;
  date: string;
  shiftLabel: string | null;
  entries: SheetEntry[];
};

const cellClass =
  "h-8 w-full rounded-md bg-transparent px-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground hover:bg-muted focus:bg-card focus:ring-2 focus:ring-primary/20";

function formatDay(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

type OrderTarget = {
  entry: SheetEntry;
  date: string;
  shiftLabel: string | null;
};

export default function LedgerSheet({
  groups,
  editable = false,
  emptyLabel = "No rows match the current filters.",
}: {
  groups: SheetGroup[];
  editable?: boolean;
  emptyLabel?: string;
}) {
  const router = useRouter();
  const columns = 10;
  const [viewing, setViewing] = useState<OrderTarget | null>(null);
  const [deleting, setDeleting] = useState<OrderTarget | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/employee/sheet/${deleting.entry.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data?.ok) {
        setDeleteError(data?.error ?? "Could not delete.");
        return;
      }
      setDeleting(null);
      router.refresh();
    } catch {
      setDeleteError("Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="tl-sheet-scroll">
      <table className="min-w-[1080px] w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-muted text-[11px] font-medium text-muted-foreground">
          <tr>
            <th className="tl-sheet-sticky-start w-[118px] px-2 py-2">Date</th>
            <th className="w-[110px] px-2 py-2">Shift</th>
            <th className="w-[110px] px-2 py-2">Order ID</th>
            <th className="min-w-[150px] px-2 py-2">Client</th>
            <th className="w-[120px] px-2 py-2">Order Value ($)</th>
            <th className="w-[72px] px-2 py-2">New</th>
            <th className="w-[130px] px-2 py-2">Status</th>
            <th className="w-[108px] px-2 py-2">End date</th>
            <th className="min-w-[160px] px-2 py-2">Notes</th>
            <th className={`tl-sheet-sticky-end ${editable ? "w-[168px]" : "w-[100px]"} px-2 py-2 text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {groups.length ? (
            groups.map((group) => (
              <GroupBlock
                key={group.workDayId}
                group={group}
                editable={editable}
                onView={(target) => setViewing(target)}
                onRequestDelete={
                  editable
                    ? (target) => {
                        setDeleteError(null);
                        setDeleting(target);
                      }
                    : undefined
                }
              />
            ))
          ) : (
            <tr>
              <td colSpan={columns} className="px-6 py-14 text-center">
                <div className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{emptyLabel}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      {viewing ? (
        <OrderViewDialog
          open
          onClose={() => setViewing(null)}
          entry={viewing.entry}
          date={viewing.date}
          shiftLabel={viewing.shiftLabel}
          editable={editable}
        />
      ) : null}
      {deleting ? (
        <OrderDeleteDialog
          open
          onClose={() => {
            if (deleteBusy) return;
            setDeleting(null);
            setDeleteError(null);
          }}
          onConfirm={() => void confirmDelete()}
          loading={deleteBusy}
          error={deleteError}
          entry={deleting.entry}
          date={deleting.date}
          shiftLabel={deleting.shiftLabel}
        />
      ) : null}
    </>
  );
}

function GroupBlock({
  group,
  editable,
  onView,
  onRequestDelete,
}: {
  group: SheetGroup;
  editable: boolean;
  onView: (target: OrderTarget) => void;
  onRequestDelete?: (target: OrderTarget) => void;
}) {
  return (
    <>
      {group.entries.map((entry, index) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          date={group.date}
          shiftLabel={group.shiftLabel}
          showDate={index === 0}
          editable={editable}
          onView={() => onView({ entry, date: group.date, shiftLabel: group.shiftLabel })}
          onRequestDelete={
            onRequestDelete
              ? () => onRequestDelete({ entry, date: group.date, shiftLabel: group.shiftLabel })
              : undefined
          }
        />
      ))}
    </>
  );
}

function EntryRow({
  entry,
  date,
  shiftLabel,
  showDate,
  editable,
  onView,
  onRequestDelete,
}: {
  entry: SheetEntry;
  date: string;
  shiftLabel: string | null;
  showDate: boolean;
  editable: boolean;
  onView: () => void;
  onRequestDelete?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employee/sheet/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not save.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function openView(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, button, a, label")) return;
    onView();
  }

  return (
    <tr
      className="cursor-pointer border-t border-border transition hover:bg-primary-soft/40"
      onClick={openView}
    >
      <td className="tl-sheet-sticky-start px-1 py-1">
        {showDate ? (
          editable ? (
            <input
              type="date"
              defaultValue={toDateInput(date)}
              className={cellClass}
              onBlur={(event) => {
                if (event.target.value && event.target.value !== toDateInput(date)) {
                  void save({ date: event.target.value });
                }
              }}
            />
          ) : (
            <span className="block px-2 py-1.5 text-[13px] font-medium text-foreground">
              {formatDay(date)}
            </span>
          )
        ) : (
          <span className="block px-2 text-muted-foreground/40">·</span>
        )}
      </td>
      <td className="px-1 py-1">
        {editable ? (
          <input
            defaultValue={shiftLabel ?? ""}
            placeholder="Shift"
            className={cellClass}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next !== (shiftLabel ?? "")) void save({ shiftLabel: next });
            }}
          />
        ) : (
          <span className="block px-2 py-1.5 text-[13px] text-muted-foreground">{shiftLabel || "—"}</span>
        )}
      </td>
      <td className="px-1 py-1">
        <Field editable={editable} defaultValue={entry.orderId ?? ""} placeholder="Order ID" onSave={(value) => save({ orderId: value })} />
      </td>
      <td className="px-1 py-1">
        <Field editable={editable} defaultValue={entry.client ?? ""} placeholder="Client" onSave={(value) => save({ client: value })} />
      </td>
      <td className="px-1 py-1">
        {editable ? (
          <Field
            editable
            defaultValue={entry.orderValueUsd?.toString() ?? ""}
            placeholder="0.00"
            type="number"
            onSave={(value) => save({ orderValueUsd: value })}
          />
        ) : (
          <span className="block px-2 py-1.5 text-[13px] tabular-nums text-foreground">
            {entry.orderValueUsd != null ? `$${entry.orderValueUsd}` : "—"}
          </span>
        )}
      </td>
      <td className="px-1 py-1">
        <Field
          editable={editable}
          defaultValue={entry.newClients?.toString() ?? ""}
          placeholder="0"
          type="number"
          onSave={(value) => save({ newClients: value })}
        />
      </td>
      <td className="px-1 py-1">
        {editable ? (
          <select
            defaultValue={entry.status ?? "Assigned"}
            className={`${cellClass} cursor-pointer`}
            onChange={(event) => void save({ status: event.target.value })}
          >
            {SHEET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        ) : (
          <div className="px-2 py-1">
            <StatusBadge status={entry.status} />
          </div>
        )}
      </td>
      <td className="px-1 py-1">
        {editable ? (
          <input
            type="date"
            defaultValue={entry.endDate ? toDateInput(entry.endDate) : ""}
            className={cellClass}
            onBlur={(event) => {
              const next = event.target.value;
              const current = entry.endDate ? toDateInput(entry.endDate) : "";
              if (next !== current) void save({ endDate: next || null });
            }}
          />
        ) : (
          <span className="block px-2 py-1.5 text-[13px] tabular-nums text-muted-foreground">
            {entry.endDate ? compactDate(entry.endDate) : "—"}
          </span>
        )}
      </td>
      <td className="px-1 py-1">
        <Field
          editable={editable}
          defaultValue={entry.notes || entry.extra || ""}
          placeholder="Notes"
          onSave={(value) => save({ notes: value })}
        />
        {error ? <div className="px-2 text-[11px] text-destructive">{error}</div> : null}
        {saving ? <div className="px-2 text-[11px] text-muted-foreground">Saving</div> : null}
      </td>
      <td className="tl-sheet-sticky-end px-2 py-1.5 align-middle" onClick={(event) => event.stopPropagation()}>
        <RowActions onView={onView} onRequestDelete={onRequestDelete} />
      </td>
    </tr>
  );
}

function RowActions({
  onView,
  onRequestDelete,
}: {
  onView: () => void;
  onRequestDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" className="tl-row-btn tl-row-btn-view" onClick={onView} title="View order">
        <ViewIcon />
        <span>View</span>
      </button>
      {onRequestDelete ? (
        <button
          type="button"
          className="tl-row-btn tl-row-btn-delete"
          onClick={onRequestDelete}
          title="Delete order"
        >
          <DeleteIcon />
          <span>Delete</span>
        </button>
      ) : null}
    </div>
  );
}

function ViewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.5 12s3.5-6 8.5-6 8.5 6 8.5 6-3.5 6-8.5 6-8.5-6-8.5-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7h8m-9 3h10l-.7 8.2A2 2 0 0 1 14.31 20H9.69a2 2 0 0 1-1.99-1.8L7 10Zm3-3V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Field({
  editable,
  defaultValue,
  placeholder,
  type = "text",
  onSave,
}: {
  editable: boolean;
  defaultValue: string;
  placeholder: string;
  type?: string;
  onSave: (value: string) => void;
}) {
  if (!editable) {
    return (
      <span className="block truncate px-2 py-1.5 text-[13px] text-foreground">{defaultValue || "—"}</span>
    );
  }

  return (
    <input
      type={type}
      step={type === "number" ? "0.01" : undefined}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={cellClass}
      onBlur={(event) => {
        if (event.target.value !== defaultValue) onSave(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
