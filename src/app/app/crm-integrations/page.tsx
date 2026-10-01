import { Alert, Badge, Button, Checkbox, CheckboxGroup, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, TextInput, ThemeIcon } from "@mantine/core";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Check, CheckCircle2, KeyRound, Map, Play, RefreshCw } from "lucide-react";
import { LinkButton } from "@/components/mantine-link";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from "@/components/leadely/table";
import { ActionForm } from "@/features/crm/components/action-form";
import { crmProvider, crmProviders, crmSyncObjects, leadelyMappingFields } from "@/features/crm-integrations/catalog";
import { CrmProviderLogo } from "@/features/crm-integrations/components/crm-provider-logo";
import { disconnectCrmConnectionAction, loadCrmIntegrations, manageCrmSyncRunAction, resolveCrmSyncIssueAction, retryCrmRecordFailureAction, saveActiveCampaignCredentialsAction, saveCrmConnectionAction, saveCrmFieldMappingAction, setCrmConnectionStateAction } from "@/features/crm-integrations/server/actions";

function directionLabel(direction: string) {
  if (direction === "import") return "CRM → Bizcraw";
  if (direction === "export") return "Bizcraw → CRM";
  return "Bizcraw ↔ CRM";
}

function statusColor(status: string) {
  if (status === "connected") return "teal";
  if (status === "error") return "red";
  if (status === "paused") return "yellow";
  return "gray";
}

export default async function CrmIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; object?: string; oauth?: string }>;
}) {
  const [{ provider: requestedProvider, object: requestedObject, oauth }, data] = await Promise.all([searchParams, loadCrmIntegrations()]);
  const selectedProvider = crmProvider(requestedProvider || "") || crmProvider(data.connections[0]?.provider) || crmProviders[0];
  const selectedConnection = data.connections.find((connection) => connection.provider === selectedProvider.id);
  const selectedObject = crmSyncObjects.includes(requestedObject as (typeof crmSyncObjects)[number])
    ? requestedObject as (typeof crmSyncObjects)[number]
    : "contacts";
  const selectedMappings = selectedConnection ? data.mappings.filter((mapping) => mapping.connection_id === selectedConnection.id) : [];
  const selectedProviderConfig = data.providerConfigs.find((config) => config.provider === selectedProvider.id);
  const providerCredentialsReady = selectedProvider.credentials.length === 0
    || Boolean(selectedProviderConfig?.credentials_configured)
    || selectedProvider.credentials.every((name) => Boolean(process.env[name]));
  const providerAvailable = Boolean(selectedProviderConfig?.enabled);
  const canManage = data.context.memberRole === "owner" || data.context.memberRole === "admin";
  const connected = data.connections.filter((connection) => connection.status === "connected").length;
  const errors = data.connections.filter((connection) => connection.status === "error").length;
  const syncedRecords = data.runs.reduce((sum, run) => sum + run.records_created + run.records_updated, 0);

  return (
    <Stack gap="md">
      <PageHeader
        title="CRM Integration"
        subtitle="Keep contacts, companies, deals and activities synchronized between Bizcraw and the CRM your team already uses."
      />
      {oauth === "connected" ? <Alert color="teal">CRM authorization completed successfully.</Alert> : null}
      {oauth && oauth !== "connected" ? <Alert color="red">CRM authorization could not be completed ({oauth.replaceAll("_", " ")}). Check the provider configuration and try again.</Alert> : null}

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <Paper withBorder radius="md" p="md"><Text size="xs" c="dimmed">Configured</Text><Text fw={700} size="xl">{data.connections.length}</Text></Paper>
        <Paper withBorder radius="md" p="md"><Text size="xs" c="dimmed">Connected</Text><Text fw={700} size="xl">{connected}</Text></Paper>
        <Paper withBorder radius="md" p="md"><Text size="xs" c="dimmed">Records synced</Text><Text fw={700} size="xl">{syncedRecords.toLocaleString()}</Text></Paper>
        <Paper withBorder radius="md" p="md"><Text size="xs" c="dimmed">Needs attention</Text><Text fw={700} size="xl" c={errors ? "red" : undefined}>{errors}</Text></Paper>
      </SimpleGrid>

      {data.issues.length ? (
        <SectionPanel title={`Sync issues · ${data.issues.length}`} padded={false}>
          <Table>
            <TableThead><TableTr><TableTh>Record</TableTh><TableTh>Issue</TableTh><TableTh>Changed</TableTh><TableTh /></TableTr></TableThead>
            <TableTbody>{data.issues.map((issue) => {
              const provider = crmProvider(data.connections.find((item) => item.id === issue.connection_id)?.provider || "");
              return <TableTr key={issue.id}>
                <TableTd><Text size="sm" fw={600}>{issue.object_type} · {issue.external_record_id}</Text><Text size="xs" c="dimmed">{provider?.name || "CRM"}</Text></TableTd>
                <TableTd><Badge size="sm" variant="light" color={issue.sync_status === "conflict" ? "orange" : "red"}>{issue.sync_status}</Badge>{issue.last_error ? <Text size="xs" c="dimmed" mt={4} lineClamp={2}>{issue.last_error}</Text> : null}</TableTd>
                <TableTd><Text size="xs">Bizcraw: {issue.leadely_updated_at ? new Date(issue.leadely_updated_at).toLocaleString() : "—"}</Text><Text size="xs">CRM: {issue.external_updated_at ? new Date(issue.external_updated_at).toLocaleString() : "—"}</Text></TableTd>
                <TableTd>{canManage && issue.sync_status === "conflict" ? <Group justify="flex-end" gap="xs" wrap="nowrap">
                  <ActionForm action={resolveCrmSyncIssueAction} submitLabel="Keep Bizcraw" layout="inline" variant="light"><input type="hidden" name="issue_id" value={issue.id} /><input type="hidden" name="resolution" value="keep_local" /></ActionForm>
                  <ActionForm action={resolveCrmSyncIssueAction} submitLabel="Use CRM" layout="inline" variant="light"><input type="hidden" name="issue_id" value={issue.id} /><input type="hidden" name="resolution" value="use_external" /></ActionForm>
                </Group> : null}</TableTd>
              </TableTr>;
            })}</TableTbody>
          </Table>
        </SectionPanel>
      ) : null}

      {data.recordFailures.length ? (
        <SectionPanel title={`Failed records · ${data.recordFailures.length}`} padded={false}>
          <Table>
            <TableThead><TableTr><TableTh>Record</TableTh><TableTh>Error</TableTh><TableTh>Attempts</TableTh><TableTh /></TableTr></TableThead>
            <TableTbody>{data.recordFailures.map((failure) => <TableTr key={failure.id}>
              <TableTd><Text size="sm" fw={600}>{failure.object_type} · {failure.external_record_id}</Text><Text size="xs" c="dimmed">{new Date(failure.last_attempt_at).toLocaleString()}</Text></TableTd>
              <TableTd><Text size="xs" lineClamp={2}>{failure.error_message}</Text></TableTd>
              <TableTd><Badge size="sm" variant="light" color={failure.status === "retrying" ? "blue" : "red"}>{failure.status} · {failure.attempt_count}</Badge></TableTd>
              <TableTd>{canManage && failure.status === "open" ? <ActionForm action={retryCrmRecordFailureAction} submitLabel="Retry record" layout="inline" variant="light"><input type="hidden" name="failure_id" value={failure.id} /></ActionForm> : null}</TableTd>
            </TableTr>)}</TableTbody>
          </Table>
        </SectionPanel>
      ) : null}

      {data.connections.length ? (
        <SectionPanel title="Connections" padded={false}>
          <Table>
            <TableThead><TableTr><TableTh>CRM</TableTh><TableTh>Sync</TableTh><TableTh>Data</TableTh><TableTh>Status</TableTh><TableTh>Last sync</TableTh><TableTh /></TableTr></TableThead>
            <TableTbody>
              {data.connections.map((connection) => {
                const provider = crmProvider(connection.provider);
                return (
                  <TableTr key={connection.id}>
                    <TableTd><Group gap="sm" wrap="nowrap">{provider ? <CrmProviderLogo {...provider} /> : null}<div><Text size="sm" fw={600}>{provider?.name || connection.provider}</Text>{connection.account_label ? <Text size="xs" c="dimmed">{connection.account_label}</Text> : null}</div></Group></TableTd>
                    <TableTd><Text size="sm">{directionLabel(connection.sync_direction)}</Text></TableTd>
                    <TableTd><Text size="sm" lineClamp={1}>{connection.sync_objects.join(", ")}</Text></TableTd>
                    <TableTd><Badge variant="light" color={statusColor(connection.status)}>{connection.status.replaceAll("_", " ")}</Badge></TableTd>
                    <TableTd><Text size="sm">{connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleString() : "Never"}</Text></TableTd>
                    <TableTd>
                      <Group justify="flex-end" gap="xs" wrap="nowrap">
                        <LinkButton href={`/app/crm-integrations?provider=${connection.provider}`} variant="subtle" size="compact-sm">Configure</LinkButton>
                        {connection.status === "connected" || connection.status === "paused" ? (
                          <ActionForm action={setCrmConnectionStateAction} submitLabel={connection.status === "paused" ? "Resume" : "Pause"} layout="inline" variant="light">
                            <input type="hidden" name="id" value={connection.id} />
                            <input type="hidden" name="mode" value={connection.status === "paused" ? "resume" : "pause"} />
                          </ActionForm>
                        ) : null}
                      </Group>
                    </TableTd>
                  </TableTr>
                );
              })}
            </TableTbody>
          </Table>
        </SectionPanel>
      ) : null}

      <SectionPanel title={`Configure ${selectedProvider.name}`}>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="sm">
            <Group wrap="nowrap"><CrmProviderLogo {...selectedProvider} size={48} /><div><Text fw={700}>{selectedProvider.name}</Text><Text size="sm" c="dimmed">{selectedProvider.description}</Text></div></Group>
            <Group gap="xs"><Badge variant="light">{selectedProvider.auth}</Badge>{selectedProvider.capabilities.map((capability) => <Badge key={capability} variant="outline" color="gray">{capability}</Badge>)}</Group>
            <Alert color={selectedConnection?.status === "connected" ? "teal" : "blue"} icon={selectedConnection?.status === "connected" ? <CheckCircle2 size={18} /> : <RefreshCw size={18} />}>
              {selectedConnection?.status === "connected"
                ? "This CRM is connected. Changes are processed using the synchronization rules on the right."
                : "Save the synchronization rules now. Provider authorization becomes available after its connector credentials are configured."}
            </Alert>
          </Stack>

          {canManage && providerAvailable ? (
            <ActionForm action={saveCrmConnectionAction} submitLabel="Save sync setup">
              <input type="hidden" name="provider" value={selectedProvider.id} />
              <TextInput name="account_label" label={selectedProvider.accountInput} placeholder={`${selectedProvider.name} connection`} defaultValue={selectedConnection?.account_label || ""} />
              <NativeSelect
                name="sync_direction"
                label="Synchronization direction"
                defaultValue={selectedConnection?.sync_direction || "bidirectional"}
                data={[
                  { value: "bidirectional", label: "Two-way · Bizcraw ↔ CRM" },
                  { value: "import", label: "Import only · CRM → Bizcraw" },
                  { value: "export", label: "Export only · Bizcraw → CRM" },
                ]}
              />
              <NativeSelect
                name="sync_interval_minutes"
                label="Automatic reconciliation"
                defaultValue={String(selectedConnection?.sync_interval_minutes || 15)}
                data={[
                  { value: "5", label: "Every 5 minutes" },
                  { value: "15", label: "Every 15 minutes" },
                  { value: "30", label: "Every 30 minutes" },
                  { value: "60", label: "Every hour" },
                  { value: "360", label: "Every 6 hours" },
                  { value: "1440", label: "Daily" },
                ]}
              />
              <NativeSelect
                name="conflict_policy"
                label="When both sides changed"
                defaultValue={selectedConnection?.conflict_policy || "latest_update"}
                data={[
                  { value: "latest_update", label: "Use the most recently updated record" },
                  { value: "leadely_wins", label: "Bizcraw wins" },
                  { value: "crm_wins", label: `${selectedProvider.name} wins` },
                ]}
              />
              <CheckboxGroup name="sync_objects" label="Data to synchronize" defaultValue={selectedConnection?.sync_objects || ["contacts", "companies", "deals"]}>
                <Group mt="xs">{crmSyncObjects.map((object) => <Checkbox key={object} value={object} label={object[0].toUpperCase() + object.slice(1)} />)}</Group>
              </CheckboxGroup>
            </ActionForm>
          ) : <Alert color={canManage ? "yellow" : "blue"}>{canManage ? "This connector is not available yet. Your Super Admin controls its rollout." : "Only workspace owners and admins can change integration settings."}</Alert>}
        </SimpleGrid>
      </SectionPanel>

      <SectionPanel title="Connection workflow">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
          {[
            { key: "authorization", label: "1. Authorize", description: selectedProvider.auth, icon: KeyRound },
            { key: "mapping", label: "2. Map fields", description: "Review standard and custom fields", icon: Map },
            { key: "initial_sync", label: "3. Initial sync", description: "Preview, deduplicate and import", icon: Play },
            { key: "active", label: "4. Automatic sync", description: "Webhooks plus scheduled reconciliation", icon: RefreshCw },
          ].map((step) => {
            const order = ["authorization", "mapping", "initial_sync", "active"];
            const current = order.indexOf(selectedConnection?.setup_step || "authorization");
            const complete = current > order.indexOf(step.key) || selectedConnection?.setup_step === "active";
            const active = step.key === (selectedConnection?.setup_step || "authorization");
            const Icon = step.icon;
            return <Paper key={step.key} withBorder radius="md" p="md" bg={active ? "var(--mantine-color-teal-0)" : undefined}><Group wrap="nowrap" align="flex-start"><ThemeIcon variant={complete ? "filled" : "light"} color={complete || active ? "teal" : "gray"}>{complete ? <Check size={16} /> : <Icon size={16} />}</ThemeIcon><div><Text size="sm" fw={700}>{step.label}</Text><Text size="xs" c="dimmed">{step.description}</Text></div></Group></Paper>;
          })}
        </SimpleGrid>
        <Alert mt="md" color={providerCredentialsReady ? "teal" : "yellow"} title={providerCredentialsReady ? "Platform credentials ready" : "Authorization setup required"}>
          {providerCredentialsReady
            ? `Bizcraw has the ${selectedProvider.name} application credentials. The provider-specific OAuth route is the next implementation step.`
            : selectedProvider.credentials.length
              ? `Super Admin must configure ${selectedProvider.credentials.join(" and ")} before users can authorize ${selectedProvider.name}.`
              : `${selectedProvider.name} requires a secure workspace credential vault for its account API URL and API key.`}
        </Alert>
        {selectedProvider.id === "activecampaign" && selectedConnection && canManage ? (
          <Stack gap="sm" mt="md">
            <ActionForm action={saveActiveCampaignCredentialsAction} submitLabel="Connect ActiveCampaign">
              <input type="hidden" name="connection_id" value={selectedConnection.id} />
              <TextInput name="api_url" label="ActiveCampaign account URL" placeholder="https://your-account.api-us1.com" defaultValue={selectedConnection.account_label || ""} required />
              <TextInput name="api_key" type="password" label="API key" placeholder={selectedConnection.status === "connected" ? "Enter a new key to replace the current one" : "Paste API key"} required />
            </ActionForm>
            {selectedConnection.status === "connected" ? <ActionForm action={disconnectCrmConnectionAction} submitLabel="Disconnect" layout="inline" variant="light"><input type="hidden" name="id" value={selectedConnection.id} /></ActionForm> : null}
          </Stack>
        ) : selectedConnection && providerAvailable && providerCredentialsReady && canManage ? (
          <Group mt="md">
            <LinkButton href={`/api/integrations/crm/${selectedProvider.id}/connect`} leftSection={<KeyRound size={16} />}>{selectedConnection.status === "connected" ? `Reconnect ${selectedProvider.name}` : `Authorize ${selectedProvider.name}`}</LinkButton>
            {selectedConnection.status === "connected" ? (
              <ActionForm action={disconnectCrmConnectionAction} submitLabel="Disconnect" layout="inline" variant="light">
                <input type="hidden" name="id" value={selectedConnection.id} />
              </ActionForm>
            ) : null}
          </Group>
        ) : <Button mt="md" disabled leftSection={<KeyRound size={16} />}>Authorize {selectedProvider.name}</Button>}
      </SectionPanel>

      <SectionPanel title="Field mapping">
        {!selectedConnection ? (
          <Alert color="blue">Save the synchronization setup first. Field mapping becomes available after a connection record is created.</Alert>
        ) : (
          <Stack gap="md">
            <Group gap="xs">{crmSyncObjects.filter((object) => selectedConnection.sync_objects.includes(object)).map((object) => <LinkButton key={object} href={`/app/crm-integrations?provider=${selectedProvider.id}&object=${object}`} variant={object === selectedObject ? "filled" : "light"} size="compact-sm">{object[0].toUpperCase() + object.slice(1)}</LinkButton>)}</Group>
            <ActionForm action={saveCrmFieldMappingAction} submitLabel="Add field mapping" layout="inline">
              <input type="hidden" name="connection_id" value={selectedConnection.id} />
              <input type="hidden" name="object_type" value={selectedObject} />
              <NativeSelect name="leadely_field" label="Bizcraw field" data={leadelyMappingFields[selectedObject]} />
              <TextInput name="external_field" label={`${selectedProvider.name} field`} placeholder="API field name" required />
              <NativeSelect name="sync_direction" label="Direction" defaultValue="bidirectional" data={[
                { value: "bidirectional", label: "Both directions" },
                { value: "import", label: "CRM → Bizcraw" },
                { value: "export", label: "Bizcraw → CRM" },
              ]} />
            </ActionForm>
            {selectedMappings.length ? (
              <Table><TableThead><TableTr><TableTh>Object</TableTh><TableTh>Bizcraw field</TableTh><TableTh>{selectedProvider.name} field</TableTh><TableTh>Direction</TableTh></TableTr></TableThead><TableTbody>{selectedMappings.map((mapping) => <TableTr key={mapping.id}><TableTd>{mapping.object_type}</TableTd><TableTd>{mapping.leadely_field}</TableTd><TableTd>{mapping.external_field}</TableTd><TableTd>{directionLabel(mapping.sync_direction)}</TableTd></TableTr>)}</TableTbody></Table>
            ) : <Text size="sm" c="dimmed">No custom mappings yet. Standard fields will be suggested automatically after authorization and schema discovery.</Text>}
          </Stack>
        )}
      </SectionPanel>

      <SectionPanel title="Available CRM connectors">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {crmProviders.map((provider) => {
            const connection = data.connections.find((item) => item.provider === provider.id);
            const available = Boolean(data.providerConfigs.find((config) => config.provider === provider.id)?.enabled);
            const selected = provider.id === selectedProvider.id;
            return (
              <Paper key={provider.id} withBorder radius="md" p="md" bg={selected ? "var(--mantine-color-teal-0)" : undefined}>
                <Group justify="space-between" wrap="nowrap"><Group gap="sm" wrap="nowrap"><CrmProviderLogo {...provider} /><div><Text size="sm" fw={700}>{provider.name}</Text><Text size="xs" c="dimmed">{provider.priority}</Text></div></Group>{connection ? <Badge size="sm" variant="light" color={statusColor(connection.status)}>{connection.status === "connected" ? "Connected" : "Configured"}</Badge> : <Badge size="sm" variant="light" color={available ? "teal" : "gray"}>{available ? "Available" : "Coming soon"}</Badge>}</Group>
                <Text size="xs" c="dimmed" mt="sm" mih={38}>{provider.description}</Text>
                <LinkButton href={`/app/crm-integrations?provider=${provider.id}`} variant={selected ? "light" : "subtle"} size="compact-sm" mt="sm">{connection ? "Edit setup" : "Configure"}</LinkButton>
              </Paper>
            );
          })}
        </SimpleGrid>
      </SectionPanel>

      <SectionPanel title="How synchronization works">
        <SimpleGrid cols={{ base: 1, md: 3 }}>
          <Group wrap="nowrap" align="flex-start"><ArrowDownToLine size={20} /><div><Text fw={600} size="sm">Import from CRM</Text><Text size="xs" c="dimmed">Pull existing and changed records into Bizcraw.</Text></div></Group>
          <Group wrap="nowrap" align="flex-start"><ArrowUpFromLine size={20} /><div><Text fw={600} size="sm">Export to CRM</Text><Text size="xs" c="dimmed">Push Bizcraw records to the connected CRM.</Text></div></Group>
          <Group wrap="nowrap" align="flex-start"><ArrowLeftRight size={20} /><div><Text fw={600} size="sm">Resolve conflicts</Text><Text size="xs" c="dimmed">Apply one explicit rule when both systems changed.</Text></div></Group>
        </SimpleGrid>
      </SectionPanel>

      {data.runs.length ? (
        <SectionPanel title="Recent sync runs" padded={false}>
          <Table><TableThead><TableTr><TableTh>Started</TableTh><TableTh>Direction</TableTh><TableTh>Status</TableTh><TableTh>Created</TableTh><TableTh>Updated</TableTh><TableTh>Failed</TableTh><TableTh /></TableTr></TableThead><TableTbody>{data.runs.map((run) => <TableTr key={run.id}><TableTd>{new Date(run.started_at).toLocaleString()}</TableTd><TableTd>{run.direction}</TableTd><TableTd><Badge size="sm" variant="light" color={run.status === "completed" ? "teal" : run.status === "dead_letter" || run.status === "failed" ? "red" : run.status === "canceled" ? "gray" : "yellow"}>{run.status.replaceAll("_", " ")}</Badge></TableTd><TableTd>{run.records_created}</TableTd><TableTd>{run.records_updated}</TableTd><TableTd>{run.records_failed}</TableTd><TableTd>{canManage && ["queued", "running"].includes(run.status) ? <ActionForm action={manageCrmSyncRunAction} submitLabel="Cancel" layout="inline" variant="light"><input type="hidden" name="id" value={run.id} /><input type="hidden" name="mode" value="cancel" /></ActionForm> : canManage && ["failed", "partial", "canceled", "dead_letter"].includes(run.status) ? <ActionForm action={manageCrmSyncRunAction} submitLabel="Retry" layout="inline" variant="light"><input type="hidden" name="id" value={run.id} /><input type="hidden" name="mode" value="retry" /></ActionForm> : null}</TableTd></TableTr>)}</TableTbody></Table>
        </SectionPanel>
      ) : null}

      {data.audit.length ? (
        <SectionPanel title="Connection activity" padded={false}>
          <Table><TableThead><TableTr><TableTh>Time</TableTh><TableTh>CRM</TableTh><TableTh>Action</TableTh><TableTh>Actor</TableTh></TableTr></TableThead><TableTbody>{data.audit.map((entry) => {
            const connection = data.connections.find((item) => item.id === entry.connection_id);
            return <TableTr key={entry.id}><TableTd>{new Date(entry.created_at).toLocaleString()}</TableTd><TableTd>{crmProvider(connection?.provider || "")?.name || "CRM"}</TableTd><TableTd>{entry.action.replaceAll("_", " ")}</TableTd><TableTd>{entry.actor_user_id || "System"}</TableTd></TableTr>;
          })}</TableTbody></Table>
        </SectionPanel>
      ) : null}
    </Stack>
  );
}
