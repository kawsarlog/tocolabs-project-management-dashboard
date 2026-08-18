"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toAuthEmail } from "@/lib/auth/identity";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("TocoLabs");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3) {
        setError("Username must be at least 3 characters.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      const supabase = createClient();
      const authEmail = email.trim()
        ? email.trim().toLowerCase()
        : toAuthEmail(cleanUsername);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: {
          data: { username: cleanUsername },
        },
      });

      if (signUpError) {
        setError(signUpError.message || "Could not create the admin account.");
        return;
      }

      if (!data.session) {
        setError(
          "Account created, but there is no session yet. Turn OFF Confirm email in Supabase Auth, then sign in as Admin.",
        );
        return;
      }

      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "BUSINESS_ADMIN",
          businessName,
        }),
      });
      const payload = await res.json();
      if (!payload?.ok) {
        setError(payload?.error ?? "Account created, but setup failed. Try signing in as Admin.");
        return;
      }

      window.location.assign(payload.redirectTo);
    } catch {
      setError("Could not create the admin account.");
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
              Admin registration for the studio ledger.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-secondary-foreground/75">
              Only admins create accounts here. Team members are added later
              from the Team dashboard with a username and password.
            </p>
          </div>
          <div className="text-sm text-secondary-foreground/70">
            Email confirmation is off. After you register you go straight into the admin cockpit.
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
            <div className="text-sm font-medium text-muted-foreground">Admin only</div>
            <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground">
              Create an admin account
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Employees cannot sign up. After you are in, add teammates from
              Team.
            </p>

            <div className="mt-8 space-y-4">
              <Field
                id="username"
                label="Admin username"
                value={username}
                onChange={setUsername}
                autoComplete="username"
              />
              <Field
                id="email"
                label="Email (optional)"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
              />
              <Field
                id="password"
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete="new-password"
              />
              <Field
                id="businessName"
                label="Workspace name"
                value={businessName}
                onChange={setBusinessName}
                placeholder="TocoLabs"
              />
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
              {loading ? "Creating admin..." : "Create admin account"}
            </button>

            <div className="mt-4 text-sm leading-6 text-muted-foreground">
              Already an admin?{" "}
              <Link href="/login" className="font-medium text-foreground underline">
                Sign in
              </Link>
              {" "}and choose Admin.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="tl-input w-full px-3 py-3 text-sm"
      />
    </div>
  );
}
