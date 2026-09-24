"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, FileButton, Group, Stack, Text } from "@mantine/core";
import { saveWorkspaceLogoAction } from "@/lib/db/actions";
import { clientInitials, fileToCompressedDataUrl } from "@/lib/image";

async function compressLogo(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error("Ảnh cần nhỏ hơn 8 MB.");
  return fileToCompressedDataUrl(file, 512, 0.85);
}

export function LogoField({
  label = "Logo",
  initialUrl = "",
  fallbackName = "Logo",
}: {
  label?: string;
  initialUrl?: string;
  fallbackName?: string;
}) {
  const [preview, setPreview] = useState(initialUrl);
  const [dataUrl, setDataUrl] = useState("");
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPreview(initialUrl);
    setDataUrl("");
    setCleared(false);
  }, [initialUrl]);

  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <Group gap="sm" wrap="nowrap">
        <Avatar src={preview || undefined} radius="md" size={48} color="leadely">
          {clientInitials(fallbackName)}
        </Avatar>
        <FileButton
          accept="image/png,image/jpeg,image/webp"
          onChange={async (file) => {
            if (!file) return;
            try {
              const url = await compressLogo(file);
              setPreview(url);
              setDataUrl(url);
              setCleared(false);
              setError("");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Không xử lý được ảnh logo.");
            }
          }}
        >
          {(props) => (
            <Button {...props} variant="light" size="sm">
              {preview ? "Change logo" : "Upload logo"}
            </Button>
          )}
        </FileButton>
        {preview ? (
          <Button
            variant="subtle"
            color="red"
            size="sm"
            onClick={() => {
              setPreview("");
              setDataUrl("");
              setCleared(Boolean(initialUrl));
            }}
          >
            Remove
          </Button>
        ) : null}
      </Group>
      <input type="hidden" name="logo_data" value={dataUrl} />
      <input type="hidden" name="logo_clear" value={cleared ? "1" : ""} />
      {error ? (
        <Text size="xs" c="red">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}

export function WorkspaceLogoField({
  logoPath,
  shortName,
  onChange,
}: {
  logoPath: string;
  shortName: string;
  onChange: (path: string) => void;
}) {
  const [preview, setPreview] = useState(logoPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPreview(logoPath);
  }, [logoPath]);

  async function persist(dataUrl: string) {
    setBusy(true);
    setError("");
    const result = await saveWorkspaceLogoAction(dataUrl);
    setBusy(false);
    if (result.error || result.url === undefined) {
      setError(result.error || "Không lưu được logo.");
      return;
    }
    setPreview(result.url);
    onChange(result.url);
  }

  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        Logo
      </Text>
      <Group gap="sm" wrap="nowrap">
        <Avatar src={preview || undefined} radius="md" size={48} color="leadely">
          {clientInitials(shortName || "WS")}
        </Avatar>
        <FileButton
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (file) => {
            if (!file) return;
            try {
              await persist(await compressLogo(file));
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Không xử lý được ảnh logo.");
            }
          }}
        >
          {(props) => (
            <Button {...props} variant="light" size="sm" loading={busy}>
              {preview ? "Change logo" : "Upload logo"}
            </Button>
          )}
        </FileButton>
        {preview ? (
          <Button variant="subtle" color="red" size="sm" disabled={busy} onClick={() => persist("")}>
            Remove
          </Button>
        ) : null}
      </Group>
      <Text size="xs" c="dimmed">
        Dùng trên slideshow, Excel, PDF và hợp đồng.
      </Text>
      {error ? (
        <Text size="xs" c="red">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
