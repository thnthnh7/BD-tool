import { Group, Progress, Stack, Text, ThemeIcon } from "@mantine/core";
import { Check, Circle, Rocket } from "lucide-react";
import { SectionPanel } from "@/components/leadely/section-panel";
import { LinkButton } from "@/components/mantine-link";
import type { OnboardingProgress } from "@/features/onboarding/server/progress";

const steps = [
  { key: "providerConnected", label: "Connect your scraping provider", hint: "Use your own provider account and keep usage under your control.", href: "/app/settings?section=apify" },
  { key: "scrapeRunCreated", label: "Run your first targeted scrape", hint: "Choose a source and collect a small sample first.", href: "/app/leads/sources" },
  { key: "recordsReviewed", label: "Review collected records", hint: "Open a scrape run to approve useful records and reject poor or duplicate data.", href: "/app/leads/scrape" },
  { key: "recordsImported", label: "Import approved records", hint: "Open a scrape run and move reviewed data into the CRM with an auditable batch.", href: "/app/leads/scrape" },
  { key: "salesActionCreated", label: "Create the first sales action", hint: "Add a follow-up task or qualify a deal.", href: "/app/tasks" },
] as const;

export function OnboardingChecklist({ progress }: { progress: OnboardingProgress }) {
  const complete = steps.filter((step) => progress[step.key]).length;
  if (complete === steps.length) return null;
  const next = steps.find((step) => !progress[step.key])!;
  return <SectionPanel title="Set up your first working workflow">
    <Group justify="space-between" mb="md"><Text size="sm" c="dimmed">Progress is based on workspace data, so it stays accurate across devices.</Text><Text size="sm" fw={700}>{complete}/{steps.length}</Text></Group>
    <Progress value={(complete / steps.length) * 100} mb="lg" color="teal" />
    <Stack gap="md">
      {steps.map((step) => <Group key={step.key} align="flex-start" wrap="nowrap">
        <ThemeIcon variant={progress[step.key] ? "light" : "default"} color={progress[step.key] ? "teal" : "gray"} radius="xl" size="md">{progress[step.key] ? <Check size={14} /> : <Circle size={12} />}</ThemeIcon>
        <div><Text size="sm" fw={650}>{step.label}</Text><Text size="xs" c="dimmed">{step.hint}</Text></div>
      </Group>)}
    </Stack>
    <LinkButton href={next.href} mt="lg" leftSection={<Rocket size={16} />}>Continue: {next.label}</LinkButton>
  </SectionPanel>;
}
