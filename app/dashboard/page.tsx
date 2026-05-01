import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { usersCollection } from "@/lib/collections";
import OrderWorkspace from "@/components/OrderWorkspace";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const users = await usersCollection();
  const freshUser = await users.findOne({ username: user.username, active: true }, { projection: { canEditOrders: 1, role: 1 } });
  return (
    <OrderWorkspace
      user={{
        ...user,
        canEditOrders: user.role === "admin" || Boolean(freshUser?.canEditOrders)
      }}
    />
  );
}
