"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";

export default function Header({ user }: { user: SessionUser }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <img src="/jewellery-khazana-logo.png" alt="Jewellery Khazana" />
        <div>
          <p className="eyebrow">Jewellery Khazana</p>
          <h1>Order Action Report</h1>
        </div>
      </div>
      <nav>
        <Link href="/dashboard">Dashboard</Link>
        {user.role === "admin" ? <Link href="/admin">Users</Link> : null}
        <span>{user.name}</span>
        <button className="ghost" onClick={logout}>Logout</button>
      </nav>
    </header>
  );
}
