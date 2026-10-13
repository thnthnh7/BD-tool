import Link from "next/link";
import { Badge, Button, Center, Container, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { Check, Sparkles } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SectionPanel } from "@/components/leadely/section-panel";

export default async function BetaWelcomePage() {
  const context = await requireWorkspace();
  const supabase = await createClient();
  const { data: enrollment } = await supabase
    .from("beta_campaign_enrollments")
    .select("position, status, access_ends_at, beta_campaigns(max_participants, headline, description, terms_url)")
    .eq("workspace_id", context.workspaceId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!enrollment) return <Center mih="60vh"><Stack align="center"><Title order={2}>Your workspace is ready</Title><Button component={Link} href="/app">Open Bizcraw</Button></Stack></Center>;
  const campaign = Array.isArray(enrollment.beta_campaigns) ? enrollment.beta_campaigns[0] : enrollment.beta_campaigns;
  return <Center mih="70vh" p="md">
    <Container size="sm" w="100%">
      <SectionPanel>
        <Stack align="center" ta="center" gap="md">
          <ThemeIcon size={64} radius="xl" color="teal"><Sparkles size={30} /></ThemeIcon>
          <Badge size="lg" variant="light">Beta member #{enrollment.position} of {campaign?.max_participants || 200}</Badge>
          <Title order={1}>{campaign?.headline || "Welcome to Bizcraw Beta"}</Title>
          <Text c="dimmed" maw={560}>{campaign?.description}</Text>
          <Group gap="xs"><Check size={17} color="var(--mantine-color-teal-7)" /><Text fw={650}>Full access until {new Date(enrollment.access_ends_at).toLocaleDateString(context.locale, { dateStyle: "long" })}</Text></Group>
          <Text size="sm" c="dimmed">No payment card is required. You can choose a paid plan at any time.</Text>
          <Group><Button component={Link} href="/app">Start using Bizcraw</Button><Button component={Link} href="/app/billing" variant="light">View plan</Button></Group>
          {campaign?.terms_url ? <Text component={Link} href={campaign.terms_url} size="xs" c="dimmed">Program terms</Text> : null}
        </Stack>
      </SectionPanel>
    </Container>
  </Center>;
}
