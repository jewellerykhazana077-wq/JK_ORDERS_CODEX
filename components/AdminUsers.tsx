"use client";

import { useEffect, useState } from "react";
import Header from "./Header";
import type { SessionUser, UserRole } from "@/lib/types";

type UserRow = {
  _id: string;
  name: string;
  username: string;
  role: UserRole;
  active: boolean;
  canEditOrders?: boolean;
};

export default function AdminUsers({ user }: { user: SessionUser }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ username: "", password: "", role: "employee" as UserRole });

  async function loadUsers() {
    const response = await fetch("/api/users");
    const data = await response.json();
    if (response.ok) setUsers(data.rows);
  }

  async function toggleEditAccess(row: UserRow) {
    setMessage("");
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row._id, canEditOrders: !row.canEditOrders })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not update edit access.");
      return;
    }
    setMessage(!row.canEditOrders ? "Edit access assigned." : "Edit access removed.");
    await loadUsers();
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not create user.");
      return;
    }
    setMessage("User created.");
    setForm({ username: "", password: "", role: "employee" });
    await loadUsers();
  }

  return (
    <>
      <Header user={user} />
      <main className="page">
        <section className="workspace-grid users-grid">
          <form className="panel" onSubmit={submit}>
            <h2>Create login</h2>
            <label>
              User ID
              <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
            </label>
            <label>
              Password
              <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} />
            </label>
            <label>
              Role
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {message ? <p className="notice">{message}</p> : null}
            <button className="primary">Create user</button>
          </form>

          <section className="panel table-panel">
            <h2>Team logins</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>User ID</th>
                    <th>Role</th>
                    <th>Order edit access</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <tr key={row._id}>
                      <td>{row.name}</td>
                      <td>{row.username}</td>
                      <td>{row.role}</td>
                      <td>{row.role === "admin" || row.canEditOrders ? "Allowed" : "Not allowed"}</td>
                      <td>{row.active ? "Active" : "Disabled"}</td>
                      <td>
                        {row.role === "employee" ? (
                          <button className="mini-button" type="button" onClick={() => toggleEditAccess(row)}>
                            {row.canEditOrders ? "Remove edit" : "Allow edit"}
                          </button>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
