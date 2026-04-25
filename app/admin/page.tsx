import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import AdminUsers from "@/components/AdminUsers";

export default async function AdminPage() {
  const user = await requireUser("admin");
  if (!user) redirect("/dashboard");
  return <AdminUsers user={user} />;
}
