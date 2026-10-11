"use client";

import { useState } from "react";
import { Alert, Button, Group, Progress, Text, TextInput } from "@mantine/core";
import { SectionPanel } from "@/components/leadely/section-panel";
import { saveProviderBudgetAction } from "@/features/leads/server/provider-budget";

export function ProviderBudgetControl({ limitUsd, usedUsd, canManage }: { limitUsd: number | null; usedUsd: number; canManage: boolean }) {
  const [message, setMessage] = useState("");
  async function save(formData: FormData) { const result = await saveProviderBudgetAction(formData); setMessage(result.error || "Provider budget saved."); }
  const percent = limitUsd && limitUsd > 0 ? Math.min(100, usedUsd / limitUsd * 100) : 0;
  return <SectionPanel title="Monthly provider spending control">
    <Group justify="space-between"><Text size="sm">Used this month: <strong>${usedUsd.toFixed(2)}</strong></Text><Text size="sm" c="dimmed">{limitUsd == null ? "No workspace limit" : `$${limitUsd.toFixed(2)} limit`}</Text></Group>
    {limitUsd != null ? <Progress value={percent} color={percent >= 100 ? "red" : percent >= 80 ? "orange" : "teal"} mt="sm" /> : null}
    {canManage ? <form action={save}><Group align="end" mt="md"><TextInput name="monthly_limit_usd" type="number" min={0} step="0.01" label="Monthly limit (USD)" defaultValue={limitUsd ?? ""} placeholder="Blank means no limit" /><Button type="submit">Save limit</Button></Group></form> : null}
    {message ? <Alert mt="sm" color={message.includes("saved") ? "teal" : "red"}>{message}</Alert> : null}
    <Text size="xs" c="dimmed" mt="sm">Once recorded usage reaches this amount, Bizcraw blocks new provider runs server-side. Existing runs can finish.</Text>
  </SectionPanel>;
}
