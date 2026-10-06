"use client";

import { useMemo, useState } from "react";
import { Anchor, Badge, Box, Button, Divider, Drawer, Group, ScrollArea, Stack, Text, ThemeIcon } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { BookOpen, Check, ExternalLink, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { refreshActorContractAction } from "@/features/leads/server/source-actions";
import { readableActorMarkdown } from "@/features/leads/actor-guide";
import type { StructuredActorGuide } from "@/features/leads/actor-guide";

export function ActorGuideDrawer({
  sourceId,
  actorTitle,
  actorUrl,
  readmeMarkdown,
  structuredGuide,
  buildNumber,
  contractHash,
  fetchedAt,
  stale,
  canManage,
  pricingModel,
}: {
  sourceId: string;
  actorTitle: string;
  actorUrl: string;
  readmeMarkdown: string;
  structuredGuide?: StructuredActorGuide;
  buildNumber: string | null;
  contractHash: string | null;
  fetchedAt: string | null;
  stale: boolean;
  canManage: boolean;
  pricingModel?: string | null;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const router = useRouter();
  const readme = useMemo(() => readableActorMarkdown(readmeMarkdown), [readmeMarkdown]);

  return <>
    <Group gap="xs" wrap="wrap">
      <Button size="compact-sm" variant="light" leftSection={<BookOpen size={14} />} onClick={() => {
        open();
        void fetch("/api/leads/actor-guidance/event", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId, eventType: "guide_opened" }),
        });
      }}>How to use this Actor</Button>
      {stale ? <Badge color="yellow">Definition may be stale</Badge> : null}
    </Group>
    <Drawer opened={opened} onClose={close} title={`How to use ${actorTitle}`} position="right" size="min(720px, 92vw)" padding="lg">
      <Stack gap="md" h="100%">
        <Text size="sm" c="dimmed">Follow the short setup below. Open field details only when you need them.</Text>
        <ScrollArea h="calc(100vh - 145px)" offsetScrollbars>
          <Stack gap="lg">
            {structuredGuide ? <>
              <section>
                <Text fw={700} mb="xs">Start in 3 steps</Text>
                <Stack gap="xs">{structuredGuide.quickStart.slice(0, 3).map((step, index) => <Group key={step} align="flex-start" wrap="nowrap" gap="sm">
                  <ThemeIcon size={24} radius="xl" variant="light"><Text size="xs" fw={700}>{index + 1}</Text></ThemeIcon>
                  <Text size="sm" pt={2}>{step}</Text>
                </Group>)}</Stack>
              </section>
              {structuredGuide.inputModes.length ? <Box component="details" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 10, padding: "12px 14px" }}>
                <Box component="summary" style={{ cursor: "pointer" }}><Text component="span" fw={650} size="sm">Ways to provide input ({structuredGuide.inputModes.length})</Text></Box>
                <Stack gap="sm" mt="sm">{structuredGuide.inputModes.map((mode) => <Box key={mode.name}><Text size="sm" fw={600}>{mode.name}</Text><Text size="sm" c="dimmed">{mode.when}</Text></Box>)}</Stack>
              </Box> : null}
              <Box component="details" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 10, padding: "12px 14px" }}>
                <Box component="summary" style={{ cursor: "pointer" }}><Text component="span" fw={650} size="sm">Field help ({structuredGuide.fieldHints.length})</Text></Box>
                <Stack gap="sm" mt="sm">{structuredGuide.fieldHints.map((field) => <Box key={field.field}>
                  <Group gap={6}><Text size="sm" fw={600}>{field.label}</Text>{field.required ? <Badge size="xs" color="red" variant="light">Required</Badge> : null}</Group>
                  <Text size="sm" c="dimmed">{field.hint}</Text>
                </Box>)}</Stack>
              </Box>
              {structuredGuide.limitations.length ? <Box component="details" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 10, padding: "12px 14px" }}>
                <Box component="summary" style={{ cursor: "pointer" }}><Text component="span" fw={650} size="sm">Things to know ({structuredGuide.limitations.length})</Text></Box>
                <Stack gap={6} mt="sm">{structuredGuide.limitations.map((item) => <Group key={item} gap="xs" align="flex-start" wrap="nowrap"><ThemeIcon size={18} radius="xl" variant="light" color="gray"><Check size={11} /></ThemeIcon><Text size="sm">{item}</Text></Group>)}</Stack>
              </Box> : null}
            </> : null}
            {readme ? <Box component="details" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 10, padding: "12px 14px" }}>
              <Box component="summary" style={{ cursor: "pointer" }}><Text component="span" fw={650} size="sm">Provider documentation</Text></Box>
              <Text component="pre" size="sm" mt="sm" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", overflowWrap: "anywhere" }}>{readme}</Text>
            </Box> : <Text size="sm" c="dimmed">The provider has not published additional documentation for this build.</Text>}
            <Divider />
            <Stack gap="xs">
              <Group gap="xs" wrap="wrap">
                {pricingModel ? <Badge variant="light">Pricing: {pricingModel}</Badge> : null}
                {buildNumber ? <Badge variant="light" color={stale ? "yellow" : "gray"}>Build {buildNumber}</Badge> : null}
                {contractHash ? <Badge variant="outline" color="gray">Contract {contractHash.slice(0, 10)}</Badge> : null}
              </Group>
              {fetchedAt ? <Text size="xs" c="dimmed">Checked {new Date(fetchedAt).toLocaleString()}</Text> : null}
              <Group gap="sm">
                <Anchor href={actorUrl} target="_blank" rel="noreferrer" size="sm">Open on Apify <ExternalLink size={13} style={{ verticalAlign: "middle" }} /></Anchor>
                {canManage ? <Button size="compact-sm" variant="subtle" loading={pending} leftSection={<RefreshCw size={13} />} onClick={async () => {
                  setPending(true);
                  setStatus("");
                  const formData = new FormData();
                  formData.set("source_id", sourceId);
                  const result = await refreshActorContractAction(formData);
                  setPending(false);
                  setStatus(result.error || "Actor definition refreshed.");
                  if (!result.error) router.refresh();
                }}>Refresh definition</Button> : null}
              </Group>
              {status ? <Text size="sm" c={status.endsWith("refreshed.") ? "teal" : "red"}>{status}</Text> : null}
            </Stack>
          </Stack>
        </ScrollArea>
      </Stack>
    </Drawer>
  </>;
}
