"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toAuthEmail } from "@/lib/auth/identity";

type Portal = "admin" | "employee";

export default function LoginPage() {
  const [portal, setPortal] = useState<Portal>("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: toAuthEmail(username),
        password,
      });

      if (signInError) {
        setError(signInError.message || "Invalid credentials.");
        return;
      }

      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syncRole: false,
          expectedPortal: portal,
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        await supabase.auth.signOut();
        setError(data?.error ?? "Login failed.");
        return;
      }

      window.location.assign(data.redirectTo);
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-6xl items-stretch lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-secondary px-10 py-12 text-secondary-foreground lg:flex lg:flex-col lg:justify-between">
          <div className="font-mono text-sm font-bold lowercase tracking-[0.18em] text-primary">
            toco labs
          </div>
          <div className="max-w-lg">
            <h1 className="font-serif text-5xl font-medium leading-tight tracking-tight text-balance">
              Studio ledger for teams that already work in sheets.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-secondary-foreground/75">
              Employees keep a live work sheet. Admins review every row, pending
              item, and revenue total without asking for a separate file.
            </p>
          </div>
          <div className="grid max-w-lg gap-6 sm:grid-cols-3">
            <div>
              <div className="font-mono text-[11px] tracking-[0.12em] text-primary">Workflow</div>
              <div className="mt-1 text-sm font-medium">Sheet-style</div>
            </div>
            <div>
              <div className="font-mono text-[11px] tracking-[0.12em] text-primary">Admin</div>
              <div className="mt-1 text-sm font-medium">Deep tracking</div>
            </div>
            <div>
              <div className="font-mono text-[11px] tracking-[0.12em] text-primary">Access</div>
              <div className="mt-1 text-sm font-medium">Multi-tenant</div>
            </div>
          </div>
        </section>

        <form
          onSubmit={onSubmit}
          className="flex w-full flex-col justify-center px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-10"
        >
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="font-mono text-sm font-bold lowercase tracking-[0.18em] text-primary">
                toco labs
              </div>
            </div>

            <div className="text-sm font-medium text-muted-foreground">Sign in</div>
            <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground">
              {portal === "admin" ? "Admin access" : "Team member access"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {portal === "admin"
                ? "Sign in to the admin cockpit. New studios can create an admin account."
                : "Sign in to your work sheet. Your admin creates your username and password from Team."}
            </p>

            <div
              className="mt-6 grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted p-1"
              role="tablist"
              aria-label="Choose how to sign in"
            >
              <button
                type="button"
                role="tab"
                aria-selected={portal === "admin"}
                onClick={() => {
                  setPortal("admin");
                  setError(null);
                }}
                className={`rounded-md px-3 py-3 text-sm font-semibold transition ${
                  portal === "admin"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={portal === "employee"}
                onClick={() => {
                  setPortal("employee");
                  setError(null);
                }}
                className={`rounded-md px-3 py-3 text-sm font-semibold transition ${
                  portal === "employee"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Employee <span className="hidden sm:inline">/ Team member</span>
              </button>
            </div>

            <div className="mt-8 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="tl-input w-full px-3 py-3 text-sm"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="tl-input w-full px-3 py-3 text-sm"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="tl-btn-primary mt-6 h-12 w-full text-sm"
            >
              {loading
                ? "Signing in..."
                : portal === "admin"
                  ? "Sign in as admin"
                  : "Sign in as team member"}
            </button>

            {portal === "admin" ? (
              <div className="mt-4 text-sm leading-6 text-muted-foreground">
                Need an admin account?{" "}
                <Link href="/register" className="font-medium text-foreground underline">
                  Register as admin
                </Link>
              </div>
            ) : (
              <div className="mt-4 text-sm leading-6 text-muted-foreground">
                Team members cannot self-register. Ask an admin to add you from
                the Team page.
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
