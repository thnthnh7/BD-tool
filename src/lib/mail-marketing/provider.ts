import "server-only";

export function providerReadiness() {
  return {
    apiKey: Boolean(process.env.RESEND_API_KEY),
    webhookSecret: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    signingSecret: Boolean(process.env.EMAIL_SIGNING_SECRET || process.env.CRON_SECRET),
  };
}

export async function sendLifecycleEmail(input: {
  fromName: string; fromEmail: string; replyTo?: string; to: string; subject: string; html: string; unsubscribeUrl: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${input.fromName} <${input.fromEmail}>`, to: [input.to], subject: input.subject, html: input.html,
      reply_to: input.replyTo || undefined,
      headers: { "List-Unsubscribe": `<${input.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  const result = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: { message?: string } };
  if (!response.ok || !result.id) throw new Error(result.message || result.error?.message || `Resend returned ${response.status}`);
  return result.id;
}

export function emailHtml(input: { body: string; ctaLabel: string; clickUrl: string; preferencesUrl: string; unsubscribeUrl: string }) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const paragraphs = input.body.split(/\n\s*\n/).map((part) => `<p style="margin:0 0 16px;line-height:1.6">${escape(part).replaceAll("\n", "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f7f6;font-family:Arial,sans-serif;color:#10231f"><div style="max-width:600px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #dce6e2;border-radius:14px;padding:30px"><div style="font-size:22px;font-weight:800;margin-bottom:24px">Bizcraw</div>${paragraphs}<a href="${escape(input.clickUrl)}" style="display:inline-block;background:#087f5b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">${escape(input.ctaLabel)}</a></div><p style="font-size:12px;color:#667a74;text-align:center;line-height:1.5">You receive this email because you have a Bizcraw account.<br><a href="${escape(input.preferencesUrl)}">Email preferences</a> · <a href="${escape(input.unsubscribeUrl)}">Unsubscribe</a></p></div></body></html>`;
}
