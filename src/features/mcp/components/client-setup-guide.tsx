"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Code, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { Check, Copy, ExternalLink, Info } from "lucide-react";

type ClientKind = "chatgpt" | "claude" | "codex" | "cursor" | "generic";

const labels: Record<ClientKind, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  codex: "Codex",
  cursor: "Cursor",
  generic: "Other client",
};

function configFor(client: ClientKind, endpoint: string) {
  if (client === "codex") return `[mcp_servers.bizcraw]\nurl = "${endpoint}"\nbearer_token_env_var = "BIZCRAW_MCP_TOKEN"`;
  if (client === "chatgpt") return endpoint;
  return JSON.stringify({ mcpServers: { bizcraw: { type: "http", url: endpoint, headers: { Authorization: "Bearer <YOUR_TOKEN>" } } } }, null, 2);
}

export function McpClientSetupGuide({ endpoint, writeEnabled }: { endpoint: string; writeEnabled: boolean }) {
  const [client, setClient] = useState<ClientKind>("chatgpt");
  const [copied, setCopied] = useState(false);
  const config = useMemo(() => configFor(client, endpoint), [client, endpoint]);
  const copy = async () => {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return <Stack gap="md" data-tutorial-id="mcp-client-setup">
    <Alert color={writeEnabled ? "teal" : "blue"} icon={<Info size={18} />} data-tutorial-id="mcp-client-status">
      {writeEnabled
        ? "Read and write tools are available. Bizcraw still requires approval for paid or externally meaningful actions."
        : "MCP is currently in read-only rollout. You can connect a client and use workspace and CRM read tools; write tools will appear after the platform rollout is enabled."}
    </Alert>
    <SegmentedControl
      fullWidth
      value={client}
      onChange={(value) => setClient(value as ClientKind)}
      data={(Object.keys(labels) as ClientKind[]).map((value) => ({ value, label: <span data-tutorial-id={`mcp-client-${value}`}>{labels[value]}</span> }))}
      data-tutorial-id="mcp-client-selector"
    />
    {client === "chatgpt" ? <Stack gap={6} data-tutorial-id="mcp-oauth-setup">
      <Text fw={600}>Connect with OAuth</Text>
      <Text size="sm">In ChatGPT, create a custom MCP app, choose OAuth, and enter the Bizcraw server URL below. ChatGPT will open Bizcraw so you can sign in, review scopes and authorize the workspace.</Text>
      <Text size="xs" c="dimmed">Full read/write MCP support depends on the user&apos;s ChatGPT plan and workspace policy.</Text>
      <Button component="a" href="https://chatgpt.com/#settings/Connectors" target="_blank" rel="noreferrer" variant="light" rightSection={<ExternalLink size={14} />} w="fit-content">Open ChatGPT settings</Button>
    </Stack> : <Stack gap={6} data-tutorial-id="mcp-token-setup">
      <Text fw={600}>Connect with an access token</Text>
      <Text size="sm">Create a connection above with only the permissions this client needs. Copy the token once, then replace <Code>&lt;YOUR_TOKEN&gt;</Code> or set <Code>BIZCRAW_MCP_TOKEN</Code> on your device.</Text>
    </Stack>}
    <div data-tutorial-id="mcp-server-config">
      <Group justify="space-between" mb={6}>
        <Text size="sm" fw={600}>{client === "chatgpt" ? "Server URL" : "Client configuration"}</Text>
        <Button size="compact-sm" variant="subtle" onClick={copy} leftSection={copied ? <Check size={14} /> : <Copy size={14} />}>{copied ? "Copied" : "Copy"}</Button>
      </Group>
      <Code block>{config}</Code>
    </div>
    <Stack gap={4} data-tutorial-id="mcp-verify-connection">
      <Text size="sm" fw={600}>Verify the connection</Text>
      <Text size="sm">Ask the client: <Code>What Bizcraw workspace am I connected to?</Code> A successful response should use the <Code>get_workspace</Code> tool and show this connection&apos;s Last used time above.</Text>
    </Stack>
  </Stack>;
}
