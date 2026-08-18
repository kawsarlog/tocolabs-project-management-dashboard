"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AddEmployeeForm from "@/components/admin/AddEmployeeForm";

type TeamMember = {
  id: string;
  username: string;
  displayName: string;
  status: "ACTIVE" | "INACTIVE";
  employeeProfile: {
    displayName: string | null;
    department: string | null;
    designation: string | null;
  } | null;
  metrics: {
    orders: number;
    revenueUsd: number;
    pending: number;
    latestDate: string | null;
  };
};

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function TeamManager({
  members,
}: {
  members: TeamMember[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      [member.displayName, member.username, member.employeeProfile?.department, member.employeeProfile?.designation]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [members, query]);

  async function resetPassword(id: string) {
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not reset password.");
        return;
      }
      setPassword("");
      setOpenId(null);
    } catch {
      setError("Could not reset password.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, label: string) {
    if (
      !window.confirm(
        `Delete ${label}? Their work days, sheet rows, and comments will be removed with the account.`,
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not delete employee.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not delete employee.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="tl-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">People</h2>
            <p className="text-sm text-muted-foreground">
              Provision access, reset credentials, and open any sheet.
            </p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter team"
            className="tl-input h-10 w-full px-3 text-sm sm:w-56"
          />
        </div>

        {error ? (
          <div className="mx-4 mt-4 rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="divide-y divide-border">
          {filtered.length ? (
            filtered.map((member) => {
              const label = member.displayName || member.username;
              return (
                <div key={member.id} className="px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <a href={`/admin/team/${member.id}`} className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-sm font-semibold text-accent">
                        {initials(label)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {label}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">
                          @{member.username}
                          {member.employeeProfile?.designation
                            ? ` · ${member.employeeProfile.designation}`
                            : ""}
                          {member.employeeProfile?.department
                            ? ` · ${member.employeeProfile.department}`
                            : ""}
                        </div>
                      </div>
                    </a>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <Metric label="Rows" value={String(member.metrics.orders)} />
                      <Metric label="Revenue" value={`$${member.metrics.revenueUsd.toFixed(0)}`} />
                      <Metric label="Pending" value={String(member.metrics.pending)} />
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          member.status === "ACTIVE"
                            ? "bg-success-soft text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {member.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={`/admin/team/${member.id}`}
                      className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      Open sheet
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenId(openId === member.id ? null : member.id);
                        setPassword("");
                        setError(null);
                      }}
                      className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(member.id, label)}
                      disabled={busyId === member.id}
                      className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-destructive hover:bg-destructive-soft disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>

                  {openId === member.id ? (
                    <div className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-muted p-3 sm:flex-row sm:items-center">
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="New password"
                        className="tl-input h-10 flex-1 px-3 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => void resetPassword(member.id)}
                        disabled={busyId === member.id}
                        className="tl-btn-primary h-10 px-4 text-sm"
                      >
                        {busyId === member.id ? "Saving..." : "Set password"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No teammates match that filter. Create someone from the panel on the right.
            </div>
          )}
        </div>
      </section>

      <AddEmployeeForm />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">
        {label}
      </div>
      <div className="font-medium tabular-nums text-foreground">{value}</div>
    </div>
  );
}
