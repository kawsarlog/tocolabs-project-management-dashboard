export type EntryLike = {
  orderValueUsd?: number | null;
  status?: string | null;
  newClients?: number | null;
};

export type RevenueTotals = {
  orders: number;
  revenueExcludingComplete: number;
  revenueIncludingComplete: number;
  pending: number;
  delivered: number;
  complete: number;
  newClients: number;
};

export function statusKey(status?: string | null) {
  return (status ?? "").trim().toLowerCase();
}

export function isCompleteStatus(status?: string | null) {
  return statusKey(status) === "complete";
}

export function isPendingStatus(status?: string | null) {
  return statusKey(status).includes("pending");
}

export function isDeliveredStatus(status?: string | null) {
  return statusKey(status) === "delivered";
}

export function emptyTotals(): RevenueTotals {
  return {
    orders: 0,
    revenueExcludingComplete: 0,
    revenueIncludingComplete: 0,
    pending: 0,
    delivered: 0,
    complete: 0,
    newClients: 0,
  };
}

export function summarizeEntries(entries: EntryLike[]): RevenueTotals {
  return entries.reduce((acc, entry) => {
    const value = entry.orderValueUsd ?? 0;
    acc.orders += 1;
    acc.revenueIncludingComplete += value;
    if (!isCompleteStatus(entry.status)) acc.revenueExcludingComplete += value;
    if (isPendingStatus(entry.status)) acc.pending += 1;
    if (isDeliveredStatus(entry.status)) acc.delivered += 1;
    if (isCompleteStatus(entry.status)) acc.complete += 1;
    acc.newClients += entry.newClients ?? 0;
    return acc;
  }, emptyTotals());
}

export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
