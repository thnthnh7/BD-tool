import { Alert, Button, Group, List, Stack, Text, ThemeIcon } from "@mantine/core";
import { Check, KeyRound } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { requireWorkspace, requireModule } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { mcpScopeLabelKeys } from "@/features/mcp/scopes";
import { mcpResource, normalizeOAuthScopes, validPkceChallenge } from "@/features/mcp/server/oauth";
import { approveMcpOAuthAction, denyMcpOAuthAction } from "@/features/mcp/server/oauth-actions";
import { getTranslations } from "next-intl/server";

type Params = { client_id?: string; redirect_uri?: string; state?: string; code_challenge?: string; code_challenge_method?: string; resource?: string; scope?: string };

export default async function McpAuthorizePage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireModule("mcp_access");
  await requireWorkspace();
  const params = await searchParams;
  const { data: client } = await createAdminClient().from("mcp_oauth_clients").select("client_id, client_name, redirect_uris, status").eq("client_id", params.client_id || "").maybeSingle();
  const resource = params.resource || mcpResource();
  if (!client || client.status !== "active" || !client.redirect_uris.includes(params.redirect_uri || "") || params.code_challenge_method !== "S256" || !validPkceChallenge(params.code_challenge || "") || resource !== mcpResource()) notFound();
  const scopes = normalizeOAuthScopes(params.scope);
  const t = await getTranslations("Mcp");
  const hidden = <>{Object.entries({ client_id: client.client_id, redirect_uri: params.redirect_uri || "", state: params.state || "", code_challenge: params.code_challenge || "", resource, scope: scopes.join(" ") }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}</>;
  return <Stack gap="md" maw={760}>
    <PageHeader title={t("authorizeTitle")} subtitle={t("authorizeSubtitle", { client: client.client_name })} />
    <SectionPanel title={t("requestedAccess")}>
      <Stack gap="md">
        <Alert color="blue" icon={<KeyRound size={18} />}>{t("authorizeWarning")}</Alert>
        <List spacing="xs" icon={<ThemeIcon color="teal" size={22} radius="xl"><Check size={14} /></ThemeIcon>}>
          {scopes.map((scope) => <List.Item key={scope}><Text size="sm">{t(mcpScopeLabelKeys[scope])}</Text></List.Item>)}
        </List>
        <Text size="xs" c="dimmed">{t("redirectDestination", { url: params.redirect_uri || "" })}</Text>
        <Group>
          <form action={approveMcpOAuthAction}>{hidden}<Button type="submit">{t("authorize")}</Button></form>
          <form action={denyMcpOAuthAction}>{hidden}<Button type="submit" variant="default">{t("cancel")}</Button></form>
        </Group>
      </Stack>
    </SectionPanel>
  </Stack>;
}
