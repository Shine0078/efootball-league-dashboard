import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.email) {
    redirect("/admin/login");
  }
  return <AdminPanel email={session.email} role={session.role ?? "admin"} />;
}