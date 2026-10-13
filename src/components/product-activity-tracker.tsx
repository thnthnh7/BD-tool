"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ProductActivityTracker({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    const key = `bizcraw:activity:${workspaceId}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 15 * 60_000) return;
    localStorage.setItem(key, String(Date.now()));
    void fetch("/api/mail-marketing/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, path: pathname }) }).then((response) => { if (!response.ok) localStorage.removeItem(key); }).catch(() => localStorage.removeItem(key));
  }, [pathname, workspaceId]);
  return null;
}
