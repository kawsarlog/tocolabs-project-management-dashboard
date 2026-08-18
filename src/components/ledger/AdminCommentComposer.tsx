"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminCommentComposer({
  workDayId,
}: {
  workDayId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workDayId, message }),
      });

      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not save comment.");
        return;
      }

      setMessage("");
      router.refresh();
    } catch {
      setError("Could not save comment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 w-full flex-col gap-2 sm:flex-row sm:items-center">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Add admin note"
        className="tl-input h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:max-w-xs"
      />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60 sm:min-h-10"
      >
        Note
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </form>
  );
}

