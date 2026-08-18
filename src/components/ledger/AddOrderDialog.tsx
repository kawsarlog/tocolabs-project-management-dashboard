"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { SHEET_STATUSES } from "@/lib/sheet";

export default function AddOrderDialog({
  buttonLabel = "Add order",
}: {
  buttonLabel?: string;
}) {
  const router = useRouter();
  const titleId = useId();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [shiftLabel, setShiftLabel] = useState("");
  const [orderId, setOrderId] = useState("");
  const [client, setClient] = useState("");
  const [orderValueUsd, setOrderValueUsd] = useState("");
  const [newClients, setNewClients] = useState("");
  const [status, setStatus] = useState("Assigned");
  const [notes, setNotes] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setDate(today);
    setShiftLabel("");
    setOrderId("");
    setClient("");
    setOrderValueUsd("");
    setNewClients("");
    setStatus("Assigned");
    setNotes("");
    setEndDate("");
    setError(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          shiftLabel,
          orderId,
          client,
          orderValueUsd,
          newClients,
          status,
          notes,
          endDate: endDate || null,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not add order.");
        return;
      }
      resetForm();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not add order.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="tl-btn-primary h-11 min-h-11 w-full px-4 text-sm sm:w-auto" onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId} size="lg">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-foreground">
              Add order
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Fill the fields below. End date is optional and can stay empty.
            </p>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="add-date">
              <input
                id="add-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="Shift" htmlFor="add-shift">
              <input
                id="add-shift"
                value={shiftLabel}
                onChange={(event) => setShiftLabel(event.target.value)}
                placeholder="e.g. 6PM–2AM"
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="Order ID" htmlFor="add-order-id">
              <input
                id="add-order-id"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="Client" htmlFor="add-client">
              <input
                id="add-client"
                value={client}
                onChange={(event) => setClient(event.target.value)}
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="Order Value ($)" htmlFor="add-value">
              <input
                id="add-value"
                type="number"
                min="0"
                step="0.01"
                value={orderValueUsd}
                onChange={(event) => setOrderValueUsd(event.target.value)}
                placeholder="0.00"
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="New Clients" htmlFor="add-new-clients">
              <input
                id="add-new-clients"
                type="number"
                min="0"
                step="1"
                value={newClients}
                onChange={(event) => setNewClients(event.target.value)}
                placeholder="0"
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <Field label="Status" htmlFor="add-status">
              <select
                id="add-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="tl-input h-11 w-full px-3 text-sm"
              >
                {SHEET_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="End date" htmlFor="add-end-date" hint="Optional">
              <input
                id="add-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="tl-input h-11 w-full px-3 text-sm"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" htmlFor="add-notes">
                <textarea
                  id="add-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="tl-input w-full px-3 py-2.5 text-sm"
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="tl-btn-ghost h-11 px-4 text-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="tl-btn-primary h-11 px-5 text-sm">
              {loading ? "Saving..." : "Save order"}
            </button>
          </div>
        </form>
      </Modal>
    </>
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
