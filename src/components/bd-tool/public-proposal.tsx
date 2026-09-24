"use client";

import { useEffect, useState } from "react";
import { Paper, Text } from "@mantine/core";
import { Slideshow } from "@/components/bd-tool/slideshow";
import { publicProposalPdfUrl } from "@/lib/quotes/files";
import type { Client, CompanySettings, Quote } from "@/lib/types";

export function PublicProposal({
  shareId,
  settings,
  quote,
  client,
}: {
  shareId?: string;
  settings: CompanySettings;
  quote: Quote;
  client: Client | null;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const uploaded = quote.presentationSource === "upload";

  useEffect(() => {
    if (!uploaded || !shareId) return;
    let cancelled = false;
    void publicProposalPdfUrl(shareId).then((result) => {
      if (cancelled) return;
      if (result.url) setUrl(result.url);
      else setError(result.error || "Không mở được PDF.");
    });
    return () => {
      cancelled = true;
    };
  }, [shareId, uploaded]);

  if (!uploaded) {
    return <Slideshow settings={settings} quote={quote} client={client} allowExport />;
  }

  if (error) {
    return <Text c="dimmed">{error}</Text>;
  }

  if (!url) {
    return <Text c="dimmed">Đang mở PDF…</Text>;
  }

  return (
    <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
      <iframe title={quote.proposalPdfName || "Proposal"} src={url} style={{ width: "100%", height: "80vh", border: 0 }} />
    </Paper>
  );
}
