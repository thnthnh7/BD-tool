"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon, Badge, Group, Stack, Text, TextInput, ThemeIcon } from "@mantine/core";
import { Building2, CalendarDays, Mail, MapPin, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/mantine-link";
import { DashboardPanel } from "./dashboard-panel";
import classes from "@/styles/leadely-dashboard.module.css";

const ACTIONS = [
  { href: "/app/leads/scrape", label: "Find new leads", icon: MapPin },
  { href: "/app/inbox", label: "Draft a follow-up email", icon: Mail },
  { href: "/app/companies", label: "Summarize a company", icon: Building2 },
  { href: "/app/calendar", label: "Prepare for a meeting", icon: CalendarDays },
] as const;

export function AiAssistantPanel() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  return (
    <DashboardPanel
      className={`${classes.rowPanel} ${classes.aiPanel}`}
      minHeight={320}
      padded
      title={
        <Group gap={10} wrap="nowrap">
          <ThemeIcon size={28} radius="md" color="leadely" variant="light">
            <Sparkles size={15} />
          </ThemeIcon>
          <Text className={classes.panelTitle}>AI Assistant</Text>
          <Badge size="xs" color="leadely">
            BETA
          </Badge>
        </Group>
      }
    >
      <Stack gap={8} style={{ flex: 1 }}>
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <LinkButton
              key={action.href}
              href={action.href}
              variant="white"
              fullWidth
              justify="space-between"
              className={classes.aiAction}
              leftSection={<Icon size={16} />}
              rightSection={
                <Text c="leadely" size="sm">
                  →
                </Text>
              }
            >
              {action.label}
            </LinkButton>
          );
        })}
      </Stack>

      <form
        style={{ marginTop: 12 }}
        onSubmit={(event) => {
          event.preventDefault();
          const needle = prompt.trim().toLowerCase();
          const match = ACTIONS.find((action) => action.label.toLowerCase().includes(needle) || (needle && action.href.includes(needle.replaceAll(" ", ""))));
          router.push(match?.href || "/app/quotes/new");
        }}
      >
        <TextInput
          className={classes.aiAsk}
          placeholder="Ask Leadely to open a workspace action..."
          value={prompt}
          onChange={(event) => setPrompt(event.currentTarget.value)}
          rightSection={
            <ActionIcon type="submit" color="leadely" variant="filled" aria-label="Send">
              <Sparkles size={16} />
            </ActionIcon>
          }
        />
      </form>
    </DashboardPanel>
  );
}
