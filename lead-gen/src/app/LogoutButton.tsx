"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" className="secondary" onClick={handleLogout} style={{ padding: "0.4rem 0.85rem" }}>
      Log out
    </button>
  );
}
