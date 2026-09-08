"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "../../icons";
import { LogoutButton } from "../../LogoutButton";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  mustChangePassword: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ email: string; emailSent: boolean; temporaryPassword?: string } | null>(
    null
  );

  function load() {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((body) => setUsers(body.data));
  }

  useEffect(load, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create user");

      setLastResult({ email: body.email, emailSent: body.emailSent, temporaryPassword: body.temporaryPassword });
      setEmail("");
      setName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
        <ChevronLeft size={14} /> Back to worklist
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0.5rem 0 1.5rem" }}>
        <h1 style={{ margin: 0 }}>Team accounts</h1>
        <LogoutButton />
      </div>

      <section>
        <h2>Add a team member</h2>
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="new-email">Email</label>
            <input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div>
            <label htmlFor="new-name">Name (optional)</label>
            <input id="new-name" type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create account"}
          </button>
        </form>

        {lastResult && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: 10, background: "var(--page)" }}>
            {lastResult.emailSent ? (
              <p className="success-text">Welcome email sent to {lastResult.email}.</p>
            ) : (
              <>
                <p className="error-text">
                  No SMTP configured — email was not sent. Share this temporary password with {lastResult.email} directly:
                </p>
                <code style={{ fontSize: "0.95rem" }}>{lastResult.temporaryPassword}</code>
              </>
            )}
          </div>
        )}
      </section>

      <section>
        <h2>All accounts</h2>
        {!users ? (
          <p>Loading...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.name}</td>
                  <td>{u.role}</td>
                  <td>{u.mustChangePassword ? "Must change password" : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
