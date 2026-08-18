"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/ledger/StatusBadge";
import Modal from "@/components/ui/Modal";
import { formatUsdPrecise } from "@/lib/money";
import { compactDate, SHEET_STATUSES } from "@/lib/sheet";

type OrderPreview = {
  id: string;
  orderId: string | null;
  client: string | null;
  orderValueUsd: number | null;
  newClients: number | null;
  status: string | null;
  notes: string | null;
  extra: string | null;
  endDate: string | null;
};

type OrderFormValues = {
  date: string;
  shiftLabel: string;
  orderId: string;
  client: string;
  orderValueUsd: string;
  newClients: string;
  status: string;
  notes: string;
  endDate: string;
};

function formatDay(iso: string) {
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00.000Z`);
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

function display(value?: string | number | null) {
  if (value == null || value === "") return "—";
  return String(value);
}

function valuesFrom(entry: OrderPreview, date: string, shiftLabel: string | null): OrderFormValues {
  return {
    date: toDateInput(date),
    shiftLabel: shiftLabel ?? "",
    orderId: entry.orderId ?? "",
    client: entry.client ?? "",
    orderValueUsd: entry.orderValueUsd != null ? String(entry.orderValueUsd) : "",
    newClients: entry.newClients != null ? String(entry.newClients) : "",
    status: entry.status || "Assigned",
    notes: entry.notes || entry.extra || "",
    endDate: entry.endDate ? toDateInput(entry.endDate) : "",
  };
}

export function OrderViewDialog({
  open,
  onClose,
  entry,
  date,
  shiftLabel,
  editable = false,
}: {
  open: boolean;
  onClose: () => void;
  entry: OrderPreview;
  date: string;
  shiftLabel: string | null;
  editable?: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const fieldId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [form, setForm] = useState<OrderFormValues>(() => valuesFrom(entry, date, shiftLabel));
  const [saved, setSaved] = useState<OrderFormValues>(() => valuesFrom(entry, date, shiftLabel));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = valuesFrom(entry, date, shiftLabel);
    setForm(next);
    setSaved(next);
    setMode("view");
    setError(null);
    setLoading(false);
  }, [entry, date, shiftLabel, open]);

  useEffect(() => {
    if (mode === "edit") firstFieldRef.current?.focus();
  }, [mode]);

  const canEdit = editable && Boolean(entry.id);
  const editing = canEdit && mode === "edit";
  const notes = saved.notes;
  const orderValue = saved.orderValueUsd === "" ? null : Number(saved.orderValueUsd);

  function update<K extends keyof OrderFormValues>(key: K, value: OrderFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function closeAll() {
    if (loading) return;
    setMode("view");
    setError(null);
    setForm(saved);
    onClose();
  }

  function backToView() {
    if (loading) return;
    setMode("view");
    setError(null);
    setForm(saved);
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/employee/sheet/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          shiftLabel: form.shiftLabel,
          orderId: form.orderId,
          client: form.client,
          orderValueUsd: form.orderValueUsd,
          newClients: form.newClients,
          status: form.status,
          notes: form.notes,
          endDate: form.endDate || null,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not save order.");
        return;
      }
      setSaved(form);
      setMode("view");
      router.refresh();
    } catch {
      setError("Could not save order.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={closeAll}
      labelledBy={titleId}
      size={editing ? "lg" : "md"}
      locked={loading}
    >
      {editing ? (
        <form onSubmit={(event) => void onSave(event)} className="space-y-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Order</p>
            <h2 id={titleId} className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              Edit order
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Update the same fields used when adding an order. End date is optional.
            </p>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor={`${fieldId}-date`}>
              <input
                ref={firstFieldRef}
                id={`${fieldId}-date`}
                type="date"
                required
                value={form.date}
                onChange={(event) => update("date", event.target.value)}
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="Shift" htmlFor={`${fieldId}-shift`}>
              <input
                id={`${fieldId}-shift`}
                value={form.shiftLabel}
                onChange={(event) => update("shiftLabel", event.target.value)}
                placeholder="e.g. 6PM–2AM"
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="Order ID" htmlFor={`${fieldId}-order-id`}>
              <input
                id={`${fieldId}-order-id`}
                value={form.orderId}
                onChange={(event) => update("orderId", event.target.value)}
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="Client" htmlFor={`${fieldId}-client`}>
              <input
                id={`${fieldId}-client`}
                value={form.client}
                onChange={(event) => update("client", event.target.value)}
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="Order Value ($)" htmlFor={`${fieldId}-value`}>
              <input
                id={`${fieldId}-value`}
                type="number"
                min="0"
                step="0.01"
                value={form.orderValueUsd}
                onChange={(event) => update("orderValueUsd", event.target.value)}
                placeholder="0.00"
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="New Clients" htmlFor={`${fieldId}-new-clients`}>
              <input
                id={`${fieldId}-new-clients`}
                type="number"
                min="0"
                step="1"
                value={form.newClients}
                onChange={(event) => update("newClients", event.target.value)}
                placeholder="0"
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="Status" htmlFor={`${fieldId}-status`}>
              <select
                id={`${fieldId}-status`}
                value={form.status}
                onChange={(event) => update("status", event.target.value)}
                className="tl-input h-11 w-full px-3 text-sm"
              >
                {SHEET_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="End date" htmlFor={`${fieldId}-end-date`} hint="Optional">
              <input
                id={`${fieldId}-end-date`}
                type="date"
                value={form.endDate}
                onChange={(event) => update("endDate", event.target.value)}
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" htmlFor={`${fieldId}-notes`}>
                <textarea
                  id={`${fieldId}-notes`}
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  rows={3}
                  className="tl-input w-full px-3 py-2.5 text-sm"
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="tl-btn-ink h-11 px-5 text-sm"
              onClick={backToView}
              disabled={loading}
            >
              Close
            </button>
            <button type="submit" disabled={loading} className="tl-btn-primary h-11 min-w-[7.5rem] px-5 text-sm">
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Order</p>
              <h2 id={titleId} className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                Order details
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {saved.orderId || saved.client || formatDay(saved.date)}
              </p>
            </div>
            <StatusBadge status={saved.status} />
          </div>

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Date" value={formatDay(saved.date)} />
            <Detail label="Shift" value={display(saved.shiftLabel)} />
            <Detail label="Order ID" value={display(saved.orderId)} />
            <Detail label="Client" value={display(saved.client)} />
            <Detail
              label="Order Value ($)"
              value={orderValue != null && Number.isFinite(orderValue) ? formatUsdPrecise(orderValue) : "—"}
            />
            <Detail label="New Clients" value={display(saved.newClients)} />
            <Detail label="Status" value={display(saved.status)} />
            <Detail
              label="End date"
              value={saved.endDate ? compactDate(saved.endDate) || formatDay(saved.endDate) : "—"}
            />
            <Detail className="sm:col-span-2" label="Notes" value={display(notes)} />
          </dl>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button type="button" className="tl-btn-ink h-11 px-5 text-sm" onClick={closeAll}>
              Close
            </button>
            {canEdit ? (
              <button
                type="button"
                className="tl-btn-primary inline-flex h-11 min-w-[7.5rem] items-center justify-center gap-2 px-5 text-sm"
                onClick={() => {
                  setError(null);
                  setForm(saved);
                  setMode("edit");
                }}
              >
                <EditIcon />
                Edit
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function OrderDeleteDialog({
  open,
  onClose,
  onConfirm,
  loading,
  error,
  entry,
  date,
  shiftLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  error?: string | null;
  entry: OrderPreview;
  date: string;
  shiftLabel: string | null;
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} describedBy={descriptionId} size="sm" locked={loading}>
      <div className="space-y-5">
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive-soft text-destructive">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              <path
                d="M8 7h8m-9 3h10l-.7 8.2A2 2 0 0 1 14.31 20H9.69a2 2 0 0 1-1.99-1.8L7 10Zm3-3V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 id={titleId} className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            Delete this order?
          </h2>
          <p id={descriptionId} className="mt-1 text-sm leading-6 text-muted-foreground">
            This cannot be undone. The row will be removed from the sheet.
          </p>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-muted px-3 py-3 text-sm">
          <div className="font-medium text-foreground">{entry.client || entry.orderId || "Untitled order"}</div>
          <div className="mt-2 space-y-1 text-muted-foreground">
            <p>
              {formatDay(date)}
              {shiftLabel ? ` · ${shiftLabel}` : ""}
            </p>
            {entry.orderId ? <p>Order ID {entry.orderId}</p> : null}
            <p>
              {entry.orderValueUsd != null ? formatUsdPrecise(entry.orderValueUsd) : "No value"}
              {entry.status ? ` · ${entry.status}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="tl-btn-ghost h-11 px-4 text-sm" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="tl-btn-danger h-11 px-5 text-sm" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Detail({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium leading-6 text-foreground">{value}</dd>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-medium text-foreground">
        <span>{label}</span>
        {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M4 20h4l10.2-10.2a1.8 1.8 0 0 0 0-2.55l-1.45-1.45a1.8 1.8 0 0 0-2.55 0L4 16v4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.2 6.8 17.2 10.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
