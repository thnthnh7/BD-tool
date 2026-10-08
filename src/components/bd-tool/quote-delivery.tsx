"use client";

import { useEffect, useState } from "react";
import { Copy, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { Alert, Button, FileButton, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { Slideshow } from "@/components/bd-tool/slideshow";
import { SectionPanel } from "@/components/leadely/section-panel";
import { canonicalDeckStyleId, DECK_STYLES } from "@/lib/deck-styles";
import { exportQuoteToExcel, exportQuoteToPdf } from "@/lib/exports";
import { exportQuoteToPptx } from "@/lib/quotes/export-pptx";
import { quoteFileUrlAction, uploadProposalPdfAction } from "@/lib/quotes/files";
import type { Client, CompanySettings, Quote } from "@/lib/types";

export function QuoteDelivery({
  settings,
  quote,
  client,
  canShare,
  canExport,
  copied,
  message,
  onChange,
  onShare,
}: {
  settings: CompanySettings;
  quote: Quote;
  client: Client | null;
  canShare: boolean;
  canExport: boolean;
  copied: boolean;
  message: string;
  onChange: (next: Partial<Quote>) => void;
  onShare: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [fileMessage, setFileMessage] = useState("");
  const [pending, setPending] = useState(false);
  const uploaded = quote.presentationSource === "upload" && Boolean(quote.proposalPdfPath);

  useEffect(() => {
    if (!uploaded) return;
    let cancelled = false;
    void quoteFileUrlAction(quote.id).then((result) => {
      if (!cancelled && result.url) setPdfUrl(result.url);
    });
    return () => {
      cancelled = true;
    };
  }, [quote.id, quote.proposalPdfPath, uploaded]);

  async function uploadPdf(file: File | null) {
    if (!file) return;
    setPending(true);
    setFileMessage("");
    const form = new FormData();
    form.set("file", file);
    const result = await uploadProposalPdfAction(quote.id, form);
    setPending(false);
    if (!result.ok || !result.path) {
      setFileMessage(result.error || "Không tải được PDF.");
      return;
    }
    if (result.url) setPdfUrl(result.url);
    onChange({ presentationSource: "upload", proposalPdfPath: result.path, proposalPdfName: result.name });
    setFileMessage("Đã tải PDF proposal.");
  }

  return (
    <Stack gap="md">
      <SectionPanel title="Proposal">
        <Text size="sm" c="dimmed">
          Khách nhận link, Excel, PDF và PowerPoint. Hợp đồng ký bằng DOCX nằm ở trang Contracts.
        </Text>
        {uploaded ? null : (
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm" mt="md">
            {DECK_STYLES.map((style) => {
              const selected = canonicalDeckStyleId(quote.deckStyle) === style.id;
              return (
                <Paper
                  key={style.id}
                  component="button"
                  type="button"
                  withBorder
                  p="sm"
                  radius="md"
                  onClick={() => onChange({ deckStyle: style.id, presentationSource: "generated" })}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: selected ? "var(--mantine-color-leadely-6)" : undefined,
                    background: selected ? "var(--mantine-color-leadely-0)" : undefined,
                  }}
                >
                  <Group gap="xs" wrap="nowrap">
                    <span style={{ width: 14, height: 14, borderRadius: 99, background: style.accent, display: "inline-block" }} />
                    <Text size="sm" fw={700}>
                      {style.name}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" mt={6} lineClamp={2}>
                    {style.blurb}
                  </Text>
                </Paper>
              );
            })}
          </SimpleGrid>
        )}
        <Group gap="xs" mt="md">
          <Button variant="default" disabled={!canShare} onClick={onShare} leftSection={<Copy size={16} />}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          {canExport ? <Button variant="default" disabled={!canShare || quote.items.length === 0} onClick={() => exportQuoteToExcel(settings, quote, client)} leftSection={<FileSpreadsheet size={16} />}>
            Excel
          </Button> : null}
          {canExport ? <Button variant="default" disabled={!canShare || quote.items.length === 0} onClick={() => exportQuoteToPdf(settings, quote, client)} leftSection={<FileText size={16} />}>
            PDF
          </Button> : null}
          {canExport && !uploaded ? (
            <Button variant="default" disabled={!canShare || quote.items.length === 0} onClick={() => void exportQuoteToPptx(settings, quote, client)} leftSection={<Presentation size={16} />}>
              PowerPoint
            </Button>
          ) : null}
          <FileButton accept="application/pdf,.pdf" onChange={uploadPdf}>
            {(props) => (
              <Button variant="default" {...props} loading={pending}>
                {quote.proposalPdfName ? "Replace PDF" : "Upload PDF"}
              </Button>
            )}
          </FileButton>
          {uploaded ? (
            <Button variant="subtle" onClick={() => onChange({ presentationSource: "generated" })}>
              Dùng deck hệ thống
            </Button>
          ) : null}
        </Group>
        {quote.proposalPdfName ? (
          <Text size="sm" mt="sm">
            PDF đã tải: {quote.proposalPdfName}
          </Text>
        ) : null}
        {message ? (
          <Alert mt="md" color={message.includes("hết") || message.includes("Không") ? "red" : "leadely"}>
            {message}
          </Alert>
        ) : null}
        {fileMessage ? (
          <Alert mt="md" color={fileMessage.startsWith("Đã") ? "leadely" : "red"}>
            {fileMessage}
          </Alert>
        ) : null}
      </SectionPanel>

      {uploaded && pdfUrl ? (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <iframe title={quote.proposalPdfName || "Proposal PDF"} src={pdfUrl} style={{ width: "100%", height: 720, border: 0 }} />
        </Paper>
      ) : (
        <Slideshow settings={settings} quote={quote} client={client} />
      )}
    </Stack>
  );
}
