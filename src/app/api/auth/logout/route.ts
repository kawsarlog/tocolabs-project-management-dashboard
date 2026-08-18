import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(req: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
