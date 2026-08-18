export type EntryPayload = {
  date?: string;
  shiftLabel: string | null;
  orderId: string | null;
  client: string | null;
  orderValueUsd: number | null;
  orderValueBdt: number | null;
  newClients: number | null;
  status: string | null;
  notes: string | null;
  extra: string | null;
  endDate?: string | null;
};

function nullableString(value: unknown) {
  if (value === undefined || value === null) return null;
  const next = String(value).trim();
  return next || null;
}

function nullableNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function nullableDate(value: unknown) {
  const next = nullableString(value);
  if (!next) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return null;
  return next;
}

export function parseEntryPayload(body: Record<string, unknown>): EntryPayload {
  const orderValueUsd = nullableNumber(body.orderValueUsd);
  const payload: EntryPayload = {
    date: body.date ? String(body.date).slice(0, 10) : undefined,
    shiftLabel: nullableString(body.shiftLabel),
    orderId: nullableString(body.orderId),
    client: nullableString(body.client),
    orderValueUsd,
    orderValueBdt: orderValueUsd != null ? Number((orderValueUsd * 122).toFixed(2)) : null,
    newClients: nullableNumber(body.newClients),
    status: nullableString(body.status),
    notes: nullableString(body.notes),
    extra: nullableString(body.extra),
  };
  if (body.endDate !== undefined) {
    payload.endDate = nullableDate(body.endDate);
  }
  return payload;
}

export function toEndDateValue(iso: string | null) {
  if (!iso) return null;
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

export function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}
