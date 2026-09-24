"use client";

import { AlertCircle, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Group, List, Paper, SimpleGrid, Stack, Text, Textarea, Title, UnstyledButton } from "@mantine/core";
import { AiPanel } from "@/components/leadely/ai-panel";
import type { AiBriefResult } from "@/lib/ai/types";
import { formatVnd } from "@/lib/money";
import type { ServiceModule } from "@/lib/types";
import classes from "@/styles/leadely-surfaces.module.css";

type AiBriefAssistantProps = {
  catalog: ServiceModule[];
  onApply: (brief: AiBriefResult) => void;
};

export function AiBriefAssistant({ catalog, onApply }: AiBriefAssistantProps) {
  const [requirements, setRequirements] = useState("");
  const [brief, setBrief] = useState<AiBriefResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);

  async function generateBrief() {
    if (!requirements.trim() || loading) return;
    setLoading(true);
    setError("");
    setApplied(false);

    try {
      const response = await fetch("/api/ai/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirements,
          catalog: catalog.slice(0, 12).map((module) => ({
            name: module.name,
            suggestedPrice: module.suggestedPrice,
          })),
        }),
      });
      const data = (await response.json()) as { brief?: AiBriefResult; error?: string; details?: string };
      if (!response.ok || !data.brief) {
        throw new Error([data.error, data.details].filter(Boolean).join(" "));
      }
      setBrief(data.brief);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo brief.");
    } finally {
      setLoading(false);
    }
  }

  const total = brief?.modules.reduce((sum, module) => sum + module.quantity * module.unitPrice, 0) || 0;

  return (
    <AiPanel title="AI Brief" description="Paste raw client requirements. Review modules and prices before applying.">
      <Textarea
        minRows={6}
        autosize
        value={requirements}
        onChange={(event) => setRequirements(event.currentTarget.value)}
        placeholder="Example: restaurant booking app for 3 branches, table map, manager dashboard..."
        maxLength={20_000}
      />
      <Group justify="space-between" mt="xs">
        <Text size="xs" c="dimmed">
          Catalog is reference only. AI suggests VND prices.
        </Text>
        <Text size="xs" c="dimmed">
          {requirements.length.toLocaleString("vi-VN")} / 20.000
        </Text>
      </Group>
      <Button mt="md" onClick={generateBrief} disabled={!requirements.trim() || loading} leftSection={<Sparkles size={16} />} loading={loading}>
        {loading ? "Calling 9Router..." : "Generate brief"}
      </Button>
      {error ? (
        <Alert mt="md" color="red" icon={<AlertCircle size={18} />}>
          {error}
        </Alert>
      ) : null}

      {brief ? (
        <Stack gap="md" mt="lg">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4} maw={720}>
              <Text size="xs" c="dimmed" fw={600}>
                Needs review
              </Text>
              <Title order={3}>{brief.projectName}</Title>
              <Text size="sm" c="dimmed">
                {brief.executiveSummary}
              </Text>
            </Stack>
            <Paper withBorder p="md" radius="lg">
              <Text size="xs" c="dimmed">
                Suggested total
              </Text>
              <Text fw={700} mt={4} c="leadely" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatVnd(total)}
              </Text>
            </Paper>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            {brief.modules.map((module, index) => (
              <UnstyledButton key={`${module.name}-${index}`} className={classes.aiAction} p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={600} size="sm">
                    {module.name}
                  </Text>
                  <Text size="sm" fw={700} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatVnd(module.quantity * module.unitPrice)}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  {module.description}
                </Text>
              </UnstyledButton>
            ))}
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <BriefList title={`Deliverables (${brief.deliverables.length})`} items={brief.deliverables.map((item) => item.name)} />
            <BriefList title="Assumptions" items={brief.assumptions} />
            <BriefList title="Out of scope" items={brief.outOfScope} />
            <BriefList title="Risks" items={brief.risks} />
          </SimpleGrid>
          {brief.clarifyingQuestions.length ? (
            <Alert color="yellow" title="Questions to confirm">
              <List size="sm" spacing={6}>
                {brief.clarifyingQuestions.map((question) => (
                  <List.Item key={question}>{question}</List.Item>
                ))}
              </List>
            </Alert>
          ) : null}
          <Group>
            <Button
              leftSection={<Check size={16} />}
              onClick={() => {
                onApply(brief);
                setApplied(true);
              }}
            >
              Apply to quote
            </Button>
            <Text size="xs" c="dimmed">
              {applied ? "Applied — continue to Catalog to edit prices." : "Fills modules, deliverables, timeline and tech stack."}
            </Text>
          </Group>
        </Stack>
      ) : null}
    </AiPanel>
  );
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  return (
    <Paper withBorder p="md" radius="lg">
      <Text fw={700} size="sm">
        {title}
      </Text>
      {items.length ? (
        <List mt="sm" size="sm" c="dimmed" spacing={6}>
          {items.slice(0, 10).map((item) => (
            <List.Item key={item}>{item}</List.Item>
          ))}
        </List>
      ) : (
        <Text size="sm" c="dimmed" mt="sm">
          None suggested.
        </Text>
      )}
    </Paper>
  );
}
