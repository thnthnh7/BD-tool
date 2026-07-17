"use client";

import dynamic from "next/dynamic";

const BdToolApp = dynamic(() => import("@/components/bd-tool/bd-tool-app").then((mod) => mod.BdToolApp), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm font-semibold text-zinc-400">
      Đang tải BD Tool...
    </div>
  ),
});

export default function Home() {
  return <BdToolApp />;
}
