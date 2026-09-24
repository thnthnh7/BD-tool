"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FileButton, Stack, Text } from "@mantine/core";
import { exportContractDocx } from "@/lib/contracts/generate-docx";
import { contractFileUrlAction, uploadContractDocxAction } from "@/lib/quotes/files";
import type { Client, CompanySettings, Quote } from "@/lib/types";

export function ContractFiles({
  contractId,
  docxName,
  settings,
  quote,
  client,
}: {
  contractId: string;
  docxName: string | null;
  settings: CompanySettings;
  quote: Quote | null;
  client: Client | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File | null) {
    if (!file) return;
    setPending(true);
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    const result = await uploadContractDocxAction(contractId, form);
    setPending(false);
    if (!result.ok) {
      setMessage(result.error || "Không tải được DOCX.");
      return;
    }
    setMessage("Đã tải DOCX.");
    router.refresh();
  }

  async function openFile() {
    const result = await contractFileUrlAction(contractId);
    if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    else setMessage(result.error || "Không mở được hợp đồng.");
  }

  return (
    <Stack gap="xs">
      <Text size="xs" fw={600} c="dimmed">
        File DOCX
      </Text>
      {docxName ? (
        <Text size="sm" lineClamp={1}>
          {docxName}
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          Chưa có file.
        </Text>
      )}
      <FileButton accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={upload}>
        {(props) => (
          <Button variant="default" size="compact-sm" {...props} loading={pending}>
            {docxName ? "Replace DOCX" : "Upload DOCX"}
          </Button>
        )}
      </FileButton>
      {docxName ? (
        <Button variant="default" size="compact-sm" onClick={openFile}>
          Mở file
        </Button>
      ) : null}
      {quote ? (
        <Button variant="default" size="compact-sm" onClick={() => exportContractDocx(settings, quote, client)}>
          Tạo DOCX từ điều khoản
        </Button>
      ) : (
        <Text size="xs" c="dimmed">
          Gắn quote để tạo DOCX từ điều khoản.
        </Text>
      )}
      {message ? (
        <Text size="xs" c={message.startsWith("Đã") ? "leadely" : "red"}>
          {message}
        </Text>
      ) : null}
    </Stack>
  );
}
