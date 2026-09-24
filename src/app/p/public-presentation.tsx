"use client";

import { useSearchParams } from "next/navigation";
import { PublicProposal } from "@/components/bd-tool/public-proposal";
import { PublicQuoteInvalid, PublicQuoteShell } from "@/app/p/public-quote-frame";
import { decodeSharedQuote } from "@/lib/share";

export function PublicPresentation() {
  const params = useSearchParams();
  const payload = decodeSharedQuote(params.get("data") || "");

  if (!payload) {
    return <PublicQuoteInvalid />;
  }

  return (
    <PublicQuoteShell>
      <PublicProposal settings={payload.settings} quote={payload.quote} client={payload.client} />
    </PublicQuoteShell>
  );
}
