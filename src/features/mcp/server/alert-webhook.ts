export type McpHealthAlertPayload = {
  event: "mcp.health.alert";
  severity: "warning";
  occurredAt: string;
  issues: string[];
  metrics: {
    windowMinutes: number;
    calls: number;
    errors: number;
    errorRate: number;
    p95: number;
    failedApprovals: number;
  };
};

export type McpAlertWebhookProvider = "generic" | "slack" | "discord" | "teams";

export function detectMcpAlertWebhookProvider(webhookUrl: string, configured?: string): McpAlertWebhookProvider {
  if (configured && ["generic", "slack", "discord", "teams"].includes(configured)) return configured as McpAlertWebhookProvider;
  const host = new URL(webhookUrl).hostname.toLowerCase();
  if (host === "hooks.slack.com") return "slack";
  if (host === "discord.com" || host === "discordapp.com") return "discord";
  if (host.endsWith("logic.azure.com") || host === "outlook.office.com" || host === "webhook.office.com") return "teams";
  return "generic";
}

function summary(payload: McpHealthAlertPayload) {
  return [
    "Bizcraw MCP health warning",
    ...payload.issues.map((issue) => `• ${issue}`),
    `Calls: ${payload.metrics.calls} · Errors: ${payload.metrics.errors} · P95: ${payload.metrics.p95} ms · Failed approvals: ${payload.metrics.failedApprovals}`,
  ].join("\n");
}

export function formatMcpAlertWebhookBody(provider: McpAlertWebhookProvider, payload: McpHealthAlertPayload) {
  const text = summary(payload);
  if (provider === "slack") {
    return {
      text,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "Bizcraw MCP health warning" } },
        { type: "section", text: { type: "mrkdwn", text: payload.issues.map((issue) => `• ${issue}`).join("\n") } },
        { type: "context", elements: [{ type: "mrkdwn", text: `*Calls:* ${payload.metrics.calls}  *Errors:* ${payload.metrics.errors}  *P95:* ${payload.metrics.p95} ms  *Failed approvals:* ${payload.metrics.failedApprovals}` }] },
      ],
    };
  }
  if (provider === "discord") {
    return { content: text, allowed_mentions: { parse: [] } };
  }
  if (provider === "teams") {
    return {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: "Bizcraw MCP health warning", weight: "Bolder", size: "Medium" },
            { type: "TextBlock", text: payload.issues.map((issue) => `• ${issue}`).join("\n"), wrap: true },
            { type: "TextBlock", text: `Calls: ${payload.metrics.calls} · Errors: ${payload.metrics.errors} · P95: ${payload.metrics.p95} ms · Failed approvals: ${payload.metrics.failedApprovals}`, wrap: true, isSubtle: true },
          ],
        },
      }],
    };
  }
  return payload;
}
