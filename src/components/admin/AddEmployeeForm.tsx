"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddEmployeeForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          displayName,
          department: department.trim() || null,
          designation: designation.trim() || null,
        }),
      });

      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Failed to create employee");
        return;
      }

      setUsername("");
      setPassword("");
      setDisplayName("");
      setDepartment("");
      setDesignation("");
      setSuccess("Employee access created. They can sign in with that username and password.");
      router.refresh();
    } catch {
      setError("Failed to create employee");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="tl-card h-fit p-5"
    >
      <div className="font-mono text-[11px] font-bold tracking-[0.14em] text-primary">
        Provision access
      </div>
      <h2 className="mt-2 text-lg font-semibold text-foreground">
        Add a team member
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Set the unique username and password they will use to sign in. You can reset the password later.
      </p>

      {error ? (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
          {success}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        <Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="Nisa" />
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="nisa"
          autoComplete="off"
        />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          type="password"
          placeholder="At least 6 characters"
          autoComplete="new-password"
        />
        <Field label="Designation" value={designation} onChange={setDesignation} placeholder="Team Member" />
        <Field label="Department" value={department} onChange={setDepartment} placeholder="Operations" />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="tl-btn-primary mt-5 h-11 w-full text-sm"
      >
        {loading ? "Creating..." : "Create employee"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="tl-input h-11 w-full px-3 text-sm"
      />
    </div>
  );
}
