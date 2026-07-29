"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Slideshow } from "@/components/bd-tool/slideshow";
import type { SharedQuotePayload } from "@/lib/share";

type Props = {
  id: string;
};

export function PublicPresentationById({ id }: Props) {
  const [payload, setPayload] = useState<SharedQuotePayload | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        const response = await fetch(`/api/share/${encodeURIComponent(id)}`);
        if (!response.ok) throw new Error("not found");
        const data = (await response.json()) as SharedQuotePayload;
        if (!cancelled) {
          setPayload(data);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setPayload(null);
          setStatus("error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        <p className="text-sm text-white/60">Đang tải báo giá...</p>
      </main>
    );
  }

  if (status === "error" || !payload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-black">Link báo giá không hợp lệ</h1>
          <p className="mt-3 text-sm text-white/60">Vui lòng kiểm tra lại link share hoặc yêu cầu gửi lại báo giá.</p>
          <Link href="/" className="mt-6 inline-flex rounded-2xl bg-[#2FF29E] px-5 py-3 text-sm font-black text-black">
            Về trang chính
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-3 md:p-6">
      <Slideshow settings={payload.settings} quote={payload.quote} client={payload.client} />
    </main>
  );
}
