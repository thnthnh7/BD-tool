import { Alert, Button, Checkbox, Container, Paper, Stack, Text, Title } from "@mantine/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMailToken } from "@/lib/mail-marketing/tokens";

export default async function EmailPreferencesPage({ searchParams }: { searchParams: Promise<{ token?: string; saved?: string; unsubscribed?: string; invalid?: string }> }) {
  const params = await searchParams;
  const payload = params.token ? verifyMailToken(params.token, "preferences") : null;
  const prefs = payload ? (await createAdminClient().from("email_preferences").select("*").eq("user_id", payload.userId).maybeSingle()).data : null;
  return <Container size="xs" py={80}><Paper withBorder radius="lg" p="xl"><Stack>
    <Title order={2}>Email preferences</Title>
    {params.saved ? <Alert color="teal">Your preferences were saved.</Alert> : null}
    {params.unsubscribed ? <Alert color="teal">You have been unsubscribed from Bizcraw lifecycle emails.</Alert> : null}
    {params.invalid || (!payload && !params.unsubscribed) ? <Alert color="red">This preferences link is invalid or has expired.</Alert> : null}
    {payload && prefs ? <form action="/api/mail-marketing/preferences" method="post"><Stack><input type="hidden" name="token" value={params.token} /><Text size="sm" c="dimmed">Choose which optional product emails Bizcraw may send to {payload.email}. Essential account messages are managed separately.</Text><Checkbox name="product_tips" defaultChecked={prefs.product_tips} label="Product tips and onboarding help" /><Checkbox name="beta_updates" defaultChecked={prefs.beta_updates} label="Beta program updates" /><Checkbox name="announcements" defaultChecked={prefs.announcements} label="Product announcements" /><Button type="submit">Save preferences</Button></Stack></form> : null}
  </Stack></Paper></Container>;
}
