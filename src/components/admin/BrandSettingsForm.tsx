"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WorkspaceMark from "@/components/brand/WorkspaceMark";

function FieldAlert({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive"
      >
        {error}
      </div>
    );
  }
  if (success) {
    return (
      <div
        role="status"
        className="rounded-md border border-success/20 bg-success-soft px-3 py-2 text-sm text-success"
      >
        {success}
      </div>
    );
  }
  return null;
}

export function ProfileSettingsForm({
  username,
  initialDisplayName,
}: {
  username: string;
  initialDisplayName: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not save display name.");
        return;
      }
      setSuccess("Display name updated.");
      router.refresh();
    } catch {
      setError("Could not save display name.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tl-card p-6 sm:p-7">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Profile</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Your sign-in username stays fixed. Display name is what the team sees next to your
          comments and account.
        </p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="admin-username" className="text-sm font-medium text-foreground">
            Username
          </label>
          <input
            id="admin-username"
            value={username}
            readOnly
            className="tl-input h-11 w-full bg-muted px-3 text-sm text-muted-foreground"
            autoComplete="username"
          />
          <p className="text-xs leading-5 text-muted-foreground">Used to sign in. Cannot be changed here.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="admin-display-name" className="text-sm font-medium text-foreground">
            Display name
          </label>
          <input
            id="admin-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="tl-input h-11 w-full px-3 text-sm"
            maxLength={80}
            placeholder="How your team should address you"
            autoComplete="name"
          />
        </div>
      </div>

      <div className="mt-5">
        <FieldAlert error={error} success={success} />
      </div>

      <div className="mt-5 flex sm:justify-end">
        <button type="submit" disabled={loading} className="tl-btn-primary h-11 w-full px-5 text-sm sm:w-auto">
          {loading ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}

export function BrandSettingsForm({
  initialName,
  initialTagline,
}: {
  initialName: string;
  initialTagline: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [tagline, setTagline] = useState(initialTagline);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tagline }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not save company details.");
        return;
      }
      setSuccess("Company details updated. Your team will see this immediately.");
      router.refresh();
    } catch {
      setError("Could not save company details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tl-card p-6 sm:p-7">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Company / brand</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          This is the workspace name employees see as “Working under …”. Keep the legal or trading
          name your team already uses.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        <div className="space-y-2">
          <label htmlFor="company-name" className="text-sm font-medium text-foreground">
            Company name
          </label>
          <input
            id="company-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="tl-input h-11 w-full px-3 text-sm"
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="company-tagline" className="text-sm font-medium text-foreground">
            Workspace line <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="company-tagline"
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            className="tl-input h-11 w-full px-3 text-sm"
            maxLength={120}
            placeholder="Operations desk · Dhaka"
          />
        </div>
      </div>

      <div className="mt-5">
        <FieldAlert error={error} success={success} />
      </div>

      <div className="mt-5 flex sm:justify-end">
        <button type="submit" disabled={loading} className="tl-btn-primary h-11 w-full px-5 text-sm sm:w-auto">
          {loading ? "Saving..." : "Save company"}
        </button>
      </div>
    </form>
  );
}

export function LogoSettingsForm({ initialLogoUrl }: { initialLogoUrl: string | null }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(initialLogoUrl);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function upload(file: File) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.append("logo", file);
      const res = await fetch("/api/admin/business/logo", { method: "POST", body });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not upload the logo.");
        return;
      }
      setPreview(data.business?.logoUrl ?? preview);
      setSuccess("Logo updated. Employees will see it in the workspace header.");
      router.refresh();
    } catch {
      setError("Could not upload the logo.");
    } finally {
      setLoading(false);
    }
  }

  async function removeLogo() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/business/logo", { method: "DELETE" });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not remove the logo.");
        return;
      }
      setPreview(null);
      setSuccess("Logo removed.");
      router.refresh();
    } catch {
      setError("Could not remove the logo.");
    } finally {
      setLoading(false);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    void upload(file);
  }

  return (
    <div className="tl-card p-6 sm:p-7">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Brand file</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Upload a square-ish logo. It appears in the admin sidebar and on the employee “Working
          under” header. PNG, JPG, WEBP, or GIF, up to 2 MB. Stored on this server.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Current company logo" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs font-medium text-white/70">No logo yet</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <label
            htmlFor="logo-file"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              onFile(event.dataTransfer.files[0]);
            }}
            className={`flex min-h-24 cursor-pointer flex-col justify-center rounded-xl border border-dashed px-4 py-4 text-sm ${
              dragging
                ? "border-primary bg-primary-soft"
                : "border-border bg-muted hover:border-primary/50"
            }`}
          >
            <span className="font-medium text-foreground">
              {loading ? "Uploading..." : "Drop an image here, or choose a file"}
            </span>
            <span className="mt-1 text-xs leading-5 text-muted-foreground">
              Square logos read clearest at 128×128 or larger.
            </span>
            <input
              id="logo-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              disabled={loading}
              onChange={(event) => {
                onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <label htmlFor="logo-file" className="tl-btn-ink inline-flex h-11 cursor-pointer items-center px-4 text-sm">
              Choose file
            </label>
            {preview ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void removeLogo()}
                className="tl-btn-ghost h-11 px-4 text-sm"
              >
                Remove logo
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <FieldAlert error={error} success={success} />
      </div>
    </div>
  );
}

export function PasswordSettingsForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not update password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated. Use the new password the next time you sign in.");
    } catch {
      setError("Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="tl-card p-6 sm:p-7">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Security</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Change the password for this admin account. Enter the current password, then the new one
          twice. Use at least 8 characters.
        </p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="current-password" className="text-sm font-medium text-foreground">
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="tl-input h-11 w-full px-3 text-sm"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm font-medium text-foreground">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="tl-input h-11 w-full px-3 text-sm"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="tl-input h-11 w-full px-3 text-sm"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
      </div>

      <div className="mt-5">
        <FieldAlert error={error} success={success} />
      </div>

      <div className="mt-5 flex sm:justify-end">
        <button type="submit" disabled={loading} className="tl-btn-ink h-11 w-full px-5 text-sm sm:w-auto">
          {loading ? "Updating..." : "Update password"}
        </button>
      </div>
    </form>
  );
}

export function BrandPreview({
  name,
  tagline,
  logoUrl,
}: {
  name: string;
  tagline: string;
  logoUrl: string | null;
}) {
  return (
    <aside className="overflow-hidden rounded-xl bg-secondary text-secondary-foreground">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="font-mono text-[11px] font-bold lowercase tracking-[0.16em] text-primary">
          Employee preview
        </div>
        <p className="mt-1 text-sm leading-5 text-white/70">
          How the workspace header looks after you save.
        </p>
      </div>
      <div className="flex items-center gap-3 px-5 py-5">
        <WorkspaceMark name={name || "Workspace"} logoUrl={logoUrl} onDark />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-white">{name || "Workspace"}</div>
          <p className="mt-1 truncate text-xs leading-5 text-white/65">
            Working under {name || "Workspace"}
          </p>
          {tagline ? (
            <p className="mt-1 truncate text-xs leading-5 text-white/50">{tagline}</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
