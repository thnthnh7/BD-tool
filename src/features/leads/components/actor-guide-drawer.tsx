"use client";

import { useMemo, useState } from "react";
import { Anchor, Badge, Button, Drawer, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { BookOpen, ExternalLink, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { refreshActorContractAction } from "@/features/leads/server/source-actions";
import { readableActorMarkdown } from "@/features/leads/actor-guide";

export function ActorGuideDrawer({
  sourceId,
  actorTitle,
  actorUrl,
  readmeMarkdown,
  buildNumber,
  contractHash,
  fetchedAt,
  stale,
  canManage,
}: {
  sourceId: string;
  actorTitle: string;
  actorUrl: string;
  readmeMarkdown: string;
  buildNumber: string | null;
  contractHash: string | null;
  fetchedAt: string | null;
  stale: boolean;
  canManage: boolean;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const router = useRouter();
  const readme = useMemo(() => readableActorMarkdown(readmeMarkdown), [readmeMarkdown]);

  return <>
    <Group gap="xs" wrap="wrap">
      <Button size="compact-sm" variant="light" leftSection={<BookOpen size={14} />} onClick={open}>How to use this Actor</Button>
      {buildNumber ? <Badge variant="light" color={stale ? "yellow" : "gray"}>Build {buildNumber}</Badge> : null}
      {stale ? <Badge color="yellow">Definition may be stale</Badge> : null}
    </Group>
    <Drawer opened={opened} onClose={close} title={`How to use ${actorTitle}`} position="right" size="min(720px, 92vw)" padding="lg">
      <Stack gap="md" h="100%">
        <Group gap="xs" wrap="wrap">
          {buildNumber ? <Badge variant="light">Build {buildNumber}</Badge> : null}
          {contractHash ? <Badge variant="outline" color="gray">Contract {contractHash.slice(0, 10)}</Badge> : null}
          {fetchedAt ? <Text size="xs" c="dimmed">Checked {new Date(fetchedAt).toLocaleString()}</Text> : null}
        </Group>
        <Group gap="sm">
          <Anchor href={actorUrl} target="_blank" rel="noreferrer" size="sm">View original on Apify <ExternalLink size={13} style={{ verticalAlign: "middle" }} /></Anchor>
          {canManage ? <Button
            size="compact-sm"
            variant="subtle"
            loading={pending}
            leftSection={<RefreshCw size={13} />}
            onClick={async () => {
              setPending(true);
              setStatus("");
              const formData = new FormData();
              formData.set("source_id", sourceId);
              const result = await refreshActorContractAction(formData);
              setPending(false);
              setStatus(result.error || "Actor definition refreshed.");
              if (!result.error) router.refresh();
            }}
          >Refresh definition</Button> : null}
        </Group>
        {status ? <Text size="sm" c={status.endsWith("refreshed.") ? "teal" : "red"}>{status}</Text> : null}
        {readme ? <ScrollArea h="calc(100vh - 190px)" offsetScrollbars>
          <Text component="pre" size="sm" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", overflowWrap: "anywhere" }}>{readme}</Text>
        </ScrollArea> : <Text size="sm" c="dimmed">This Actor does not publish a README for its default build. Use the field descriptions in the form or open the original Actor page.</Text>}
      </Stack>
    </Drawer>
  </>;
}
