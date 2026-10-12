"use client";

import { useMemo, useState } from "react";
import { Button, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";

export function CampaignBuilder() {
  const [path, setPath] = useState("/pricing");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const url = useMemo(() => {
    const target = new URL(path.startsWith("/") ? path : `/${path}`, "https://bizcraw.com");
    if (source.trim()) target.searchParams.set("utm_source", source.trim().toLowerCase());
    if (medium.trim()) target.searchParams.set("utm_medium", medium.trim().toLowerCase());
    if (campaign.trim()) target.searchParams.set("utm_campaign", campaign.trim().toLowerCase().replace(/\s+/g, "_"));
    return target.toString();
  }, [path, source, medium, campaign]);
  return <Stack gap="sm"><SimpleGrid cols={{ base: 1, md: 4 }}><TextInput label="Landing path" value={path} onChange={(event) => setPath(event.currentTarget.value)} /><TextInput label="Source" placeholder="linkedin" value={source} onChange={(event) => setSource(event.currentTarget.value)} /><TextInput label="Medium" placeholder="social" value={medium} onChange={(event) => setMedium(event.currentTarget.value)} /><TextInput label="Campaign" placeholder="october_launch" value={campaign} onChange={(event) => setCampaign(event.currentTarget.value)} /></SimpleGrid><Group justify="space-between" align="end"><Text size="sm" style={{ wordBreak: "break-all" }}>{url}</Text><Button variant="light" onClick={() => void navigator.clipboard.writeText(url)}>Copy URL</Button></Group></Stack>;
}
