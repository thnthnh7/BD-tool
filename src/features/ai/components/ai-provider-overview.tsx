"use client";

import { useState } from "react";
import { Anchor, Badge, Checkbox, Collapse, Stack, Text } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ActionForm } from "@/features/crm/components/action-form";
import { AI_PROVIDERS, type AiProviderName } from "@/features/ai/provider-catalog";
import { updateAgentSettingsAction } from "@/features/agent/server/settings";
import classes from "./ai-provider-overview.module.css";

type SavedProvider = {
  provider: string;
  model: string;
  status: string;
};

export function AiProviderOverview({
  canManage,
  enabled,
  writeEnabled,
  readyKnowledge,
  provider,
}: {
  canManage: boolean;
  enabled: boolean;
  writeEnabled: boolean;
  readyKnowledge: number;
  provider: SavedProvider | null;
}) {
  const t = useTranslations("Settings");
  const agent = useTranslations("Agent");
  const [open, setOpen] = useState(false);
  const state = (on: boolean) => (on ? t("aiStateOn") : t("aiStateOff"));
  const providerName = provider && provider.provider in AI_PROVIDERS
    ? AI_PROVIDERS[provider.provider as AiProviderName].label
    : provider?.provider;

  return (
    <Stack gap={0}>
      <div className={classes.strip}>
        <div className={classes.stat}>
          <Text size="xs" c="dimmed">{t("aiKeyLabel")}</Text>
          {provider ? (
            <Stack gap={2} className={classes.value}>
              <Text size="sm" fw={600} truncate title={providerName}>{providerName}</Text>
              <Text size="xs" c="dimmed" truncate title={provider.model}>{provider.model}</Text>
              <Badge size="sm" variant="light" color={provider.status === "active" ? "teal" : "gray"} w="fit-content">
                {provider.status === "active" ? t("active") : provider.status}
              </Badge>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed" className={classes.value}>{t("aiNone")}</Text>
          )}
        </div>
        <div className={classes.stat}>
          <Text size="xs" c="dimmed">{t("aiKnowledgeLabel")}</Text>
          <Text size="sm" fw={600} className={classes.value}>{t("aiReadyCount", { count: readyKnowledge })}</Text>
          <Anchor component={Link} href="/app/modules" size="xs">{t("aiManageKnowledge")}</Anchor>
        </div>
      </div>
      {canManage ? (
        <>
          <button type="button" className={classes.toggle} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            <Text size="sm">
              {t("aiSummary", {
                assistant: state(enabled),
                writes: state(writeEnabled),
              })}
            </Text>
            <ChevronDown size={16} className={`${classes.chevron} ${open ? classes.chevronOpen : ""}`} />
          </button>
          <Collapse expanded={open}>
            <div className={classes.settings}>
              <ActionForm action={updateAgentSettingsAction} submitLabel={agent("save")}>
                <Stack gap={16}>
                  <Checkbox name="enabled" label={agent("enabled")} defaultChecked={enabled} />
                  <Checkbox name="write_enabled" label={agent("writes")} defaultChecked={writeEnabled} />
                </Stack>
              </ActionForm>
            </div>
          </Collapse>
        </>
      ) : null}
    </Stack>
  );
}
