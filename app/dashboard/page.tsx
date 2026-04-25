import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import OrderWorkspace from "@/components/OrderWorkspace";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <OrderWorkspace user={user} />;
}
