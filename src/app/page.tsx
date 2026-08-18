import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { redirectToForRole } from "@/lib/auth/identity";

export default async function Home() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  redirect(redirectToForRole(session.role));
}
