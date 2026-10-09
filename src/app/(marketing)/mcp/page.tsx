import Link from "next/link";
import { ArrowRight, Check, KeyRound, LockKeyhole, PlugZap, ShieldCheck } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-shell";
import { createPublicMetadata, SITE_URL } from "@/lib/seo";
import baseStyles from "@/styles/seo-page.module.css";
import styles from "./mcp.module.css";

const endpoint = `${SITE_URL}/api/mcp`;
const claudeConfig = `{
  "mcpServers": {
    "bizcraw": {
      "type": "http",
      "url": "${endpoint}",
      "headers": {
        "Authorization": "Bearer <YOUR_TOKEN>"
      }
    }
  }
}`;
const codexConfig = `[mcp_servers.bizcraw]
url = "${endpoint}"
bearer_token_env_var = "BIZCRAW_MCP_TOKEN"`;

const faqs = [
  ["What is the Bizcraw MCP server?", "It is a secure interface that lets compatible AI clients use approved Bizcraw tools against the workspace connected by the user."],
  ["What replaces YOUR_TOKEN?", "Create an MCP connection inside Bizcraw and copy the access token shown once. Paste that token in the client configuration or store it in the named environment variable."],
  ["Can an AI client access every workspace?", "No. Each connection belongs to one workspace, carries explicit scopes and is subject to the user's role, plan access and server controls."],
  ["Can the client make changes automatically?", "Only granted write tools are available. Paid or externally meaningful operations can create an approval request that a workspace owner or admin must review in Bizcraw."],
] as const;

export const metadata = createPublicMetadata({
  title: "Bizcraw MCP Server | Connect AI Clients to Your Sales Workspace",
  description: "Connect ChatGPT, Claude, Codex, Cursor and other MCP clients to Bizcraw with OAuth or a scoped access token.",
  path: "/mcp",
});

export default function McpGuidePage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: "Connect an AI client to the Bizcraw MCP server",
        description: metadata.description,
        url: `${SITE_URL}/mcp`,
        dateModified: "2026-10-10",
        author: { "@id": `${SITE_URL}/#organization` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        about: { "@id": `${SITE_URL}/#software` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "MCP server", item: `${SITE_URL}/mcp` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };

  return <div className={baseStyles.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <MarketingHeader />
    <main>
      <nav className={baseStyles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">MCP server</span></nav>
      <section className={styles.hero}>
        <div>
          <span className={baseStyles.eyebrow}>MODEL CONTEXT PROTOCOL</span>
          <h1>Connect your AI client to Bizcraw.</h1>
          <p>Use the Bizcraw MCP server to let a compatible LLM read approved workspace context and call supported sales tools within your permissions.</p>
          <div className={baseStyles.heroActions}><Link href="/signup" className={baseStyles.primaryButtonLarge}>Create a workspace <ArrowRight size={18} /></Link><Link href="/login" className={baseStyles.secondaryButton}>Sign in</Link></div>
        </div>
        <div className={styles.endpointCard}><span>Production MCP endpoint</span><code>{endpoint}</code><p>Use OAuth when the client supports it. Otherwise, create a scoped access token in your Bizcraw workspace.</p></div>
      </section>

      <section className={styles.trustGrid} aria-label="MCP security controls">
        <article><PlugZap size={22} /><h2>Standard HTTP transport</h2><p>Connect through the production HTTPS endpoint from clients that support remote MCP servers.</p></article>
        <article><KeyRound size={22} /><h2>Scoped credentials</h2><p>Choose only the read or write permissions the client needs and rotate or revoke a connection at any time.</p></article>
        <article><ShieldCheck size={22} /><h2>Workspace boundaries</h2><p>Requests remain tied to the selected workspace, current plan access and server-side authorization checks.</p></article>
      </section>

      <section className={styles.guide}>
        <aside><strong>On this page</strong><a href="#prepare">Before connecting</a><a href="#oauth">OAuth setup</a><a href="#token">Access-token setup</a><a href="#verify">Verify the connection</a><a href="#safety">Permissions and safety</a></aside>
        <div className={styles.guideBody}>
          <section id="prepare"><span>01</span><h2>Before connecting</h2><p>Create or join a Bizcraw workspace whose plan includes MCP. A workspace owner or admin opens <b>Workspace → MCP</b>, checks that the service is enabled and creates the connection.</p><ul><li><Check size={17} />Use a descriptive connection name for each client.</li><li><Check size={17} />Grant the minimum scopes required for the intended workflow.</li><li><Check size={17} />Choose an expiry date and rotate credentials periodically.</li></ul></section>

          <section id="oauth"><span>02</span><h2>Connect with OAuth</h2><p>For ChatGPT and any client that supports remote MCP OAuth, add a custom MCP app and enter the production server URL. The client redirects to Bizcraw so the user can sign in, review requested scopes and authorize the workspace.</p><div className={styles.codeBlock}><small>SERVER URL</small><pre><code>{endpoint}</code></pre></div><p>OAuth is the preferred path when supported because the user reviews access in Bizcraw and can revoke it later without editing local configuration.</p></section>

          <section id="token"><span>03</span><h2>Connect with an access token</h2><p>In Bizcraw, create a connection and copy the token when it is shown. The token is the value that replaces <code>&lt;YOUR_TOKEN&gt;</code>; it is not your password, workspace ID or an API key from another provider.</p><h3>Claude, Cursor and compatible JSON clients</h3><div className={styles.codeBlock}><pre><code>{claudeConfig}</code></pre></div><h3>Codex</h3><div className={styles.codeBlock}><pre><code>{codexConfig}</code></pre></div><p>Set <code>BIZCRAW_MCP_TOKEN</code> in the local environment used to start Codex. Do not commit the token to a repository or paste it into ordinary prompts.</p></section>

          <section id="verify"><span>04</span><h2>Verify the connection</h2><p>Restart or refresh the client, then ask: <q>What Bizcraw workspace am I connected to?</q> A working connection should call <code>get_workspace</code> and the Bizcraw MCP page should show a recent Last used time.</p><ul><li><Check size={17} />A 401 response means the token is missing, expired or revoked.</li><li><Check size={17} />A 403 response can mean the plan, workspace state or requested scope does not permit the operation.</li><li><Check size={17} />If tools are absent, confirm the platform rollout and read/write controls are enabled.</li></ul></section>

          <section id="safety"><span>05</span><h2>Permissions and safety</h2><p>Bizcraw exposes workspace, CRM, data, knowledge, quote and scraping tools according to the scopes granted to the connection. Read tools retrieve only workspace-scoped data. Supported write tools use server-side validation, audit records and idempotency controls.</p><div className={styles.safetyNote}><LockKeyhole size={21} /><div><strong>Approval remains inside Bizcraw</strong><p>Actions that can incur provider usage or create an external effect may wait for owner or admin approval. Review pending requests from Workspace → MCP.</p></div></div></section>
        </div>
      </section>

      <section className={baseStyles.faqSection}><div className={baseStyles.sectionHeading}><span className={baseStyles.eyebrow}>QUESTIONS</span><h2>MCP connection answers.</h2></div><div className={baseStyles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>
      <section className={baseStyles.cta}><span>CONNECT BIZCRAW</span><h2>Give your AI client controlled access to the workspace where sales work happens.</h2><p>Start with read scopes, verify the connection, then add write permissions only when the workflow requires them.</p><Link href="/signup" className={baseStyles.lightButton}>Create workspace <ArrowRight size={18} /></Link></section>
    </main>
    <MarketingFooter />
  </div>;
}
