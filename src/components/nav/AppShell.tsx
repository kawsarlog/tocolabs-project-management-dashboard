"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import WorkspaceMark from "@/components/brand/WorkspaceMark";

type NavItem = {
  href: string;
  label: string;
  icon: "home" | "users" | "table" | "sheet" | "settings";
};

const icons: Record<NavItem["icon"], React.ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 19a5 5 0 0 1 10 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 19a4 4 0 0 1 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  table: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 10h16M10 10v9" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  sheet: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 4.5v1.6M12 17.9v1.6M19.5 12h-1.6M6.1 12H4.5M17.3 6.7l-1.1 1.1M7.8 16.2l-1.1 1.1M17.3 17.3l-1.1-1.1M7.8 7.8 6.7 6.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  ),
};

export default function AppShell({
  username,
  roleLabel,
  brandName,
  logoUrl,
  tagline,
  workingUnder,
  links,
  children,
}: {
  username: string;
  roleLabel: string;
  brandName: string;
  logoUrl?: string | null;
  tagline?: string | null;
  workingUnder?: boolean;
  links: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navId = useId();
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="tl-app">
      {open ? (
        <button
          type="button"
          className="tl-sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className={`tl-sidebar ${open ? "is-open" : ""}`} id={navId}>
        <div className="flex items-start justify-between gap-3 px-5 pt-6">
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-bold lowercase tracking-[0.16em] text-primary">
              toco labs
            </div>
            <div className="mt-3 flex items-start gap-3">
              <WorkspaceMark name={brandName} logoUrl={logoUrl} onDark />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold leading-snug text-white">{brandName}</div>
                {workingUnder ? (
                  <p className="mt-1 text-xs leading-5 text-white/65">Working under {brandName}</p>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-white/65">{roleLabel}</p>
                )}
                {tagline ? (
                  <p className="mt-1 text-xs leading-5 text-white/50">{tagline}</p>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="tl-sidebar-close"
            aria-label="Close menu"
            onClick={() => {
              setOpen(false);
              menuBtnRef.current?.focus();
            }}
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {icons[link.icon]}
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 px-5 py-4">
          <div className="truncate text-sm font-medium text-white">{username}</div>
          <form action="/api/auth/logout" method="post" className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium text-white hover:bg-white/15"
            >
              Logout
            </button>
          </form>
        </div>
      </aside>

      <div className="tl-app-main">
        <header className="tl-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={menuBtnRef}
              type="button"
              className="tl-menu-btn"
              aria-expanded={open}
              aria-controls={navId}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
            <WorkspaceMark name={brandName} logoUrl={logoUrl} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{brandName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {workingUnder ? `Working under ${brandName}` : roleLabel}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-foreground">{username}</div>
              <div className="text-xs text-muted-foreground">{workingUnder ? "Team member" : roleLabel}</div>
            </div>
            <form action="/api/auth/logout" method="post" className="hidden sm:block">
              <button type="submit" className="tl-btn-ink min-h-10 px-3 py-2 text-sm">
                Logout
              </button>
            </form>
          </div>
        </header>
        <main className="tl-content">{children}</main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
