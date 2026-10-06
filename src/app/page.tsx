import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bot, Building2, Check, CircleCheck, FileSignature, Globe2, Import, ListChecks, LockKeyhole, MessageSquareText, Quote, Search, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { LandingMotion } from "@/components/landing-motion";
import { AppLogo } from "@/components/leadely/app-logo";
import { crmProviders } from "@/features/crm-integrations/catalog";
import { formatUsdFromCents } from "@/lib/money";
import { loadPublicPlans, planHighlights } from "@/lib/public-plans";
import classes from "@/styles/landing.module.css";

const siteUrl = "https://bizcraw.com";
const title = "Bizcraw — Web Scraping and AI Sales Workspace";
const description = "Bizcraw is a web scraping and AI sales workspace that helps teams collect public business data, turn approved results into CRM records, and manage sales workflows.";
const faqs = [
  ["What is Bizcraw?", "Bizcraw is a web scraping and AI sales workspace. It helps teams collect fresh business data, turn scrape results into CRM records, and manage deals, tasks, quotes and contracts in one system."],
  ["What can I scrape with Bizcraw?", "Bizcraw provides a source library for supported web scraping actors, including workflows for business locations, search results, public professional profiles, jobs and social profiles. Available sources and usage costs are shown before a run."],
  ["How does scraped data become a sales lead?", "Every scraping run keeps its own result set. Users can review records, select useful companies and contacts, and import approved results into the workspace CRM with their source history preserved."],
  ["Can Bizcraw import my existing customer data?", "Yes. You can import structured customer data and use CRM integrations as they become available. Bizcraw keeps imported records inside the correct workspace."],
  ["Can the AI agent change workspace data?", "The agent can prepare supported actions such as creating contacts, deals, tasks and quotes. Sensitive or high-impact changes require review before they are applied."],
  ["Does Bizcraw replace a CRM?", "Bizcraw includes connected CRM workflows for small sales teams and can also synchronize with external CRM platforms as connectors become available."],
  ["Is there a free plan?", "Available public plans are shown on this page. You can create an account and choose the plan that fits your current workflow."],
  ["How does scraping pricing work?", "Scraping costs depend on the selected data source, actor events and run options. Bizcraw shows estimated usage before a run and keeps the resulting data connected to your workspace."],
] as const;
const featuredCrmIds = new Set(["hubspot", "salesforce", "dynamics_365", "monday", "pipedrive", "zoho"]);
const featuredCrmProviders = crmProviders.filter((provider) => featuredCrmIds.has(provider.id));

export const metadata: Metadata = {
  title: { absolute: title }, description, alternates: { canonical: "/" },
  openGraph: { title, description, url: siteUrl, siteName: "Bizcraw", type: "website", images: [{ url: "/landing/bizcraw-source-library-hero.png", width: 1530, height: 900, alt: "Bizcraw web scraping source library" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/landing/bizcraw-source-library-hero.png"] },
};

const jsonLd = { "@context": "https://schema.org", "@graph": [
  { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "Bizcraw", url: siteUrl, logo: `${siteUrl}/brand/bizcraw-logo.png`, description: "The organization behind the Bizcraw web scraping and AI sales workspace." },
  { "@type": "WebSite", "@id": `${siteUrl}/#website`, url: `${siteUrl}/`, name: "Bizcraw", alternateName: ["Bizcraw", "bizcraw.com"], inLanguage: "en", publisher: { "@id": `${siteUrl}/#organization` }, about: { "@id": `${siteUrl}/#software` } },
  { "@type": "WebPage", "@id": `${siteUrl}/#webpage`, url: `${siteUrl}/`, name: title, description, inLanguage: "en", isPartOf: { "@id": `${siteUrl}/#website` }, about: { "@id": `${siteUrl}/#software` } },
  { "@type": "SoftwareApplication", "@id": `${siteUrl}/#software`, name: "Bizcraw", applicationCategory: "BusinessApplication", applicationSubCategory: "Web scraping and sales intelligence", operatingSystem: "Web", description, url: siteUrl, publisher: { "@id": `${siteUrl}/#organization` }, creator: { "@id": `${siteUrl}/#organization` }, mainEntityOfPage: { "@id": `${siteUrl}/#webpage` }, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
  { "@type": "FAQPage", mainEntity: faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
] };

export default async function LandingPage() {
  const plans = await loadPublicPlans();
  const startHref = "/signup";
  return <LandingMotion><main className={classes.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <header className={classes.header}><div className={classes.navShell}>
      <Link href="/" aria-label="Bizcraw home" className={classes.logoLink}><AppLogo tagline /></Link>
      <nav className={classes.navLinks} aria-label="Primary navigation"><Link href="/features">Product</Link><Link href="/solutions">Solutions</Link><Link href="/guides">Guides</Link><Link href="/integrations">Integrations</Link><Link href="/pricing">Pricing</Link></nav>
      <div className={classes.navActions}><Link href="/login" className={classes.textButton}>Sign in</Link><Link href={startHref} className={classes.primaryButton}>Start free <ArrowRight size={16} /></Link></div>
    </div></header>

    <section className={classes.hero}><div className={classes.heroGlow} /><div className={classes.heroCopy}>
      <span className={classes.eyebrow}><Sparkles size={15} /> Web scraping + AI sales workspace</span>
      <h1>Scrape the web. Turn fresh data into <span>sales opportunities.</span></h1>
      <p>Discover business leads with repeatable web scraping workflows, review structured results, send approved records into your CRM and move every opportunity toward a deal.</p>
      <div className={classes.heroActions}><Link href={startHref} className={classes.primaryButtonLarge}>Start free <ArrowRight size={18} /></Link><Link href="/features/scraping" className={classes.secondaryButton}>Explore scraping</Link></div>
      <div className={classes.trustLine}><span><Check size={15} /> No credit card</span><span><Check size={15} /> Guided setup</span><span><Check size={15} /> Workspace-level access</span></div>
    </div><ProductStage /></section>

    <section className={classes.proofStrip}><span>Web scraping</span><i /><span>Structured lead data</span><i /><span>CRM import</span><i /><span>Deals & quotes</span><i /><span>AI workspace agent</span></section>

    <section className={classes.scrapingSection}><div className={classes.scrapingIntro}><span className={classes.sectionLabel}>SCRAPING AT THE CORE</span><h2>Web scraping built for lead generation, not disconnected exports.</h2><p>Bizcraw keeps each scraping run, its source, raw results and selected records connected. Your team can find businesses and people, review data quality, control usage and move approved leads directly into the sales workspace.</p></div><div className={classes.scrapingPillars}>{[["01","Choose a source","Browse supported scraping actors and see what each source collects."],["02","Run a targeted search","Define the market, location and result volume for a repeatable run."],["03","Review structured results","Inspect companies, websites, phones and discovered people before import."],["04","Send leads to CRM","Import only approved records while preserving where the data came from."]].map(([n,h,p])=><article key={n}><span>{n}</span><h3>{h}</h3><p>{p}</p></article>)}</div></section>

    <section className={classes.section}><Heading label="ONE CONNECTED SYSTEM" title="Sales work breaks when context lives everywhere." text="Bizcraw connects the records, documents and next actions your team needs, so every workflow starts with the same source of truth." />
      <div className={classes.compareGrid}><article className={classes.beforeCard}><span>Without Bizcraw</span><h3>Busy tools. Broken handoffs.</h3><ul><li>Prospect lists live in separate files</li><li>Deal updates disappear into chat</li><li>Quotes are rebuilt from old documents</li><li>AI answers without workspace context</li></ul></article><article className={classes.afterCard}><span>With Bizcraw</span><h3>One workflow from signal to sale.</h3><ul>{["Leads become connected records", "Every deal keeps its full history", "Quotes use current customer data", "AI acts within permissions"].map(x => <li key={x}><CircleCheck size={17} /> {x}</li>)}</ul></article></div>
    </section>

    <section id="platform" className={`${classes.section} ${classes.workflowSection}`}><div className={classes.workflowIntro}><h2>Move from research to revenue without rebuilding your process.</h2><p>Each step feeds the next. Your team spends less time transferring data and more time deciding what to do with it.</p></div>
      <div className={classes.workflowGrid}>{[[Search,"01","Discover","Find and collect relevant prospects from supported data sources."],[Import,"02","Organize","Turn raw results and imports into clean company and contact records."],[Workflow,"03","Sell","Track opportunities, owners, activities and the next best action."],[FileSignature,"04","Close","Create quotes and contracts using connected customer data."]].map(([Icon,n,name,text]) => { const I=Icon as typeof Search; return <article key={String(name)}><span className={classes.stepNumber}>{String(n)}</span><span className={classes.stepIcon}><I size={21}/></span><h3>{String(name)}</h3><p>{String(text)}</p></article> })}</div>
    </section>

    <section id="agent" className={classes.agentSection}><div className={classes.agentSectionInner}><div className={classes.agentCopy}><span className={classes.darkLabel}><Bot size={16}/> BIZCRAW AGENT</span><h2>Ask about your business. Then move the work forward.</h2><p>The agent reads only the workspace data and permissions available to the user. It can answer operational questions, prepare changes and ask for approval before sensitive actions.</p><ul><li><Check size={17}/> Answers link back to workspace records</li><li><Check size={17}/> Changes are previewed before execution</li><li><Check size={17}/> Actions respect roles and audit history</li></ul><Link href={startHref} className={classes.lightButton}>Try the workspace <ArrowRight size={17}/></Link></div><div className={classes.agentDemo}><div className={classes.demoQuestion}><MessageSquareText size={17}/> Which enterprise deals need attention this week?</div><div className={classes.demoAnswer}><div className={classes.answerTitle}><Sparkles size={17}/><strong>3 deals need attention</strong></div><p>Two have no recent activity, and one quote was viewed three times but has not received a follow-up.</p><div className={classes.answerRows}>{[["Northstar Labs","No activity · 16 days"],["Acme APAC","Quote viewed · 3 times"],["Orbit Commerce","Task overdue · 2 days"]].map(([a,b])=><span key={a}><b>{a}</b><small>{b}</small></span>)}</div><div className={classes.answerSources}><span>Sources</span><code>Deals</code><code>Quote events</code><code>Tasks</code></div></div></div></div></section>

    <section className={classes.section}><Heading label="BUILT AROUND REAL SALES WORK" title="Clear workflows for every stage of the deal." />
      <div className={classes.storyStack}><Story icon={Workflow} title="Run repeatable data collection without losing control." text="Launch scraping jobs, monitor progress, records and spend, then review every result before it becomes part of your CRM." bullets={["Run history and live status","Record and cost visibility","Review before CRM import"]}><ScrapeVisual /></Story><Story reverse icon={Building2} title="Keep every customer relationship in context." text="Companies, contacts, deals, tasks and activities stay connected so the team can see what happened and what should happen next." bullets={["Company and contact timelines","Deal stages and ownership","CRM synchronization controls"]}><CrmVisual /></Story><Story icon={Quote} title="Turn approved data into documents that close." text="Create quotes and contracts from current workspace records, then track whether a customer has received and viewed the document." bullets={["Reusable commercial defaults","Share and view tracking","Connected deal history"]}><QuoteVisual /></Story></div>
    </section>

    <section id="integrations" className={classes.integrationSection}><div className={classes.integrationCopy}><span className={classes.sectionLabel}>INTEGRATIONS</span><h2>Connect Bizcraw to the tools your team already uses.</h2><p>Start with imports and workspace-native workflows. Add CRM connections as each connector becomes available.</p></div><div className={classes.logoCloud}>{featuredCrmProviders.map((provider)=><article key={provider.id} className={classes.integrationCard}><div className={classes.integrationLogo} data-provider={provider.id}><Image src={provider.logo} alt={`${provider.name} logo`} width={110} height={42}/></div><div><h3>{provider.name}</h3><small>{provider.auth}</small></div></article>)}</div></section>

    <section className={classes.securitySection}><div><span className={classes.securityIcon}><ShieldCheck size={26}/></span><h2>Your workspace stays within its boundaries.</h2><p>Bizcraw uses workspace-scoped access, role checks and server-side secret handling to keep customer data and connected credentials separated.</p></div><div className={classes.securityPoints}><span><LockKeyhole size={19}/><b>Role-aware access</b><small>Users see and act on what their role allows.</small></span><span><Globe2 size={19}/><b>Workspace isolation</b><small>Records remain associated with the correct organization.</small></span><span><ListChecks size={19}/><b>Reviewable actions</b><small>Agent changes can require approval and leave an audit trail.</small></span></div></section>

    <section id="pricing" className={`${classes.section} ${classes.pricingSection}`}><Heading label="PRICING" title="Start with the workflow you need today." text="Choose a public plan below. You can review plan limits inside the product before upgrading."/><div className={classes.pricingGrid}>{plans.length ? plans.map((plan)=>{ const featured = plan.badge.trim().length > 0; const planHref = `/signup?plan=${encodeURIComponent(plan.id)}`; return <article key={plan.id} className={featured?classes.featuredPlan:classes.planCard}>{featured&&<span className={classes.planBadge}>{plan.badge}</span>}<span className={classes.planType}>{plan.isFree?"Free forever":"For growing teams"}</span><h3>{plan.name}</h3><div className={classes.price}>{plan.isFree?"Free":plan.usdMonthlyCents==null?"—":formatUsdFromCents(plan.usdMonthlyCents)}{!plan.isFree&&plan.usdMonthlyCents!=null&&<small>/ month</small>}</div><p>{plan.quotas.seats < 0 ? "Unlimited seats" : `${plan.quotas.seats} workspace seat${plan.quotas.seats===1?"":"s"} included.`}</p><ul>{planHighlights(plan).map((line)=><li key={line}><Check size={16}/> {line}</li>)}</ul><Link href={planHref} className={featured?classes.primaryButtonWide:classes.secondaryButtonWide}>Choose {plan.name}</Link></article>}) : <article className={classes.pricingFallback}><span className={classes.planType}>PLANS TEMPORARILY UNAVAILABLE</span><h3>Start with a Bizcraw workspace</h3><p>Current plan details could not be loaded. Create an account to review availability when the connection returns.</p><Link href={startHref} className={classes.primaryButtonWide}>Create account</Link></article>}</div><p style={{textAlign:"center",marginTop:24}}><Link href="/pricing">Compare full plan details</Link></p></section>

    <section className={classes.faqSection}>
      <div className={classes.faqHeading}>
        <span className={classes.sectionLabel}>FREQUENTLY ASKED QUESTIONS</span>
        <h2>What teams ask before getting started.</h2>
        <p>Clear answers about scraping, CRM workflows, AI actions and pricing.</p>
      </div>
      <div className={classes.faqColumns}>
        {[faqs.slice(0, 4), faqs.slice(4)].map((column, columnIndex) => (
          <div className={classes.faqList} key={columnIndex === 0 ? "faq-left" : "faq-right"}>
            {column.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}<span aria-hidden="true">+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        ))}
      </div>
    </section>
    <section className={classes.finalCta}><div><span><Sparkles size={16}/> Your sales workspace is ready</span><h2>Give your team one place to find, understand and act on every opportunity.</h2><p>Create a workspace and start organizing your sales process today.</p><Link href={startHref} className={classes.lightButtonLarge}>Start free <ArrowRight size={18}/></Link></div></section>
    <footer className={classes.footer}><div className={classes.footerBrand}><AppLogo tagline/><p>Web scraping and AI sales workspace for lead discovery, CRM operations and sales execution.</p></div><div><b>Product</b><Link href="/features">All features</Link><Link href="/features/scraping">Scraping runs</Link><Link href="/features/data-library">Data library</Link><Link href="/features/ai-sales-agent">AI sales agent</Link><Link href="/pricing">Pricing</Link></div><div><b>Solutions</b><Link href="/solutions">All solutions</Link><Link href="/web-scraping">Web scraping</Link><Link href="/web-scraping-for-lead-generation">Lead generation</Link><Link href="/google-maps-lead-scraper">Google Maps leads</Link><Link href="/data-to-crm">Data to CRM</Link></div><div><b>Resources</b><Link href="/guides">All guides</Link><Link href="/guides/how-to-build-a-prospect-list-with-web-scraping">Prospect list guide</Link><Link href="/integrations">Integrations</Link><Link href="/integrations/apify">Apify</Link></div><div><b>Company</b><Link href="/what-is-bizcraw">What is Bizcraw?</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/security">Security</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div><div className={classes.footerMeta}><span>© {new Date().getFullYear()} Bizcraw</span><span><Link href="/login">Sign in</Link> · Built for focused sales teams.</span></div></footer>
  </main></LandingMotion>;
}

function Heading({label,title,text}:{label:string;title:string;text?:string}) { return <div className={classes.centerHeading}><span className={classes.sectionLabel}>{label}</span><h2>{title}</h2>{text&&<p>{text}</p>}</div> }
function Story({icon:Icon,title,text,bullets,children,reverse}:{icon:typeof Search;title:string;text:string;bullets:string[];children:React.ReactNode;reverse?:boolean}) { return <article className={`${classes.story} ${reverse?classes.storyReverse:""}`}><div className={classes.storyCopy}><span className={classes.storyIcon}><Icon size={20}/></span><h3>{title}</h3><p>{text}</p><ul>{bullets.map(x=><li key={x}>{x}</li>)}</ul></div>{children}</article> }
function ProductStage(){return <div className={classes.heroVisual}><figure className={classes.heroScreenshot}><div className={classes.screenshotBar}><span/><span/><span/><b>Source Library</b></div><Image src="/landing/bizcraw-source-library-hero.png" alt="Bizcraw Source Library showing web scraping actors for Google Maps, Google Search, LinkedIn and social profiles" width={1530} height={900} priority sizes="(max-width: 1280px) 96vw, 1240px"/></figure></div>}
function ScrapeVisual(){return <ProductScreenshot src="/landing/bizcraw-scrape-runs.png" alt="Bizcraw scraping run history showing run status, collected records and usage costs" label="Scrape runs"/>}
function CrmVisual(){return <ProductScreenshot src="/landing/bizcraw-crm-companies.png" alt="Bizcraw CRM showing real English demo companies, industries and lead sources" label="Connected CRM"/>}
function QuoteVisual(){return <ProductScreenshot src="/landing/bizcraw-quotes.png" alt="Bizcraw quotes workspace showing real quote statuses, clients and values" label="Quotes workspace"/>}
function ProductScreenshot({src,alt,label}:{src:string;alt:string;label:string}){return <figure className={classes.productScreenshot}><div className={classes.screenshotBar}><span/><span/><span/><b>{label}</b></div><Image src={src} alt={alt} width={1050} height={650} sizes="(max-width: 900px) 100vw, 650px"/></figure>}
