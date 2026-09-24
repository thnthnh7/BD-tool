"use client";

import { useEffect, useState } from "react";
import { PublicProposal } from "@/components/bd-tool/public-proposal";
import { PublicQuoteInvalid, PublicQuoteLoading, PublicQuoteShell } from "@/app/p/public-quote-frame";
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
          fetch(`/api/share/${encodeURIComponent(id)}/engage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event_type: "opened" }),
          }).catch(() => undefined);
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
    return <PublicQuoteLoading />;
  }

  if (status === "error" || !payload) {
    return <PublicQuoteInvalid />;
  }

  return (
    <PublicQuoteShell>
      <PublicProposal shareId={id} settings={payload.settings} quote={payload.quote} client={payload.client} />
    </PublicQuoteShell>
  );
}
