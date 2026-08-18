/**
 * Production ledger lives in Supabase Postgres (work_days / work_entries /
 * employee_profiles / profiles). Local Windows keeps Prisma SQLite.
 *
 * Use the remote store when BOTH are true:
 * - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-side only)
 * - Vercel runtime (ephemeral /tmp SQLite would otherwise hide seed_demo.sql)
 */
export function hasSupabaseServiceRole() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function isVercelRuntime() {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

export function useSupabaseLedger() {
  return hasSupabaseServiceRole() && isVercelRuntime();
}
