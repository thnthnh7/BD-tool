import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bot, Check, Database, Search, ShieldCheck, Workflow } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-shell";
import { createPublicMetadata, SITE_URL } from "@/lib/seo";
import sharedStyles from "@/styles/seo-page.module.css";
import styles from "./lead-scraping-platform.module.css";

const path = "/lead-scraping-platform";
const title = "Lead Scraping Platform for B2B Sales | Bizcraw";
const description = "Collect public business data with supported scraping sources, review structured results and move approved leads into connected CRM workflows with Bizcraw.";

const faqs = [
  ["What is a lead scraping platform?", "A lead scraping platform collects public business data from supported web sources and helps teams turn the returned records into a usable prospecting workflow. Bizcraw adds source selection, guided actor inputs, result review and connected CRM operations around each run."],
  ["How is Bizcraw different from a standalone lead scraper?", "A standalone scraper commonly ends with an export. Bizcraw keeps the source, run history and selected records connected so approved data can continue into companies, contacts, lists, deals, tasks, quotes and contracts."],
  ["Does every scraped record enter the CRM automatically?", "No. Users can review the result set and choose which records should enter the active workspace. This keeps irrelevant or incomplete records out of the sales pipeline."],
  ["Which data sources can I use?", "Bizcraw provides a source library of supported scraping actors. Available inputs, estimated usage and result structures depend on the selected actor and are shown in the product before a run."],
  ["Can the Bizcraw AI Agent help configure a scrape?", "The AI Agent can explain supported actors, clarify input fields and help users understand the expected output. Workspace actions remain subject to the user’s access and applicable approval boundaries."],
  ["Is Bizcraw a lead database?", "Bizcraw is built around on-demand collection from supported public sources rather than access to a single prebuilt contact database. Teams control the source, run and review process for each result set."],
] as const;

export const metadata: Metadata = createPublicMetadata({ title, description, path });

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}${path}#webpage`,
      url: `${SITE_URL}${path}`,
      name: title,
      description,
      inLanguage: "en",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#software` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Bizcraw",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Lead scraping platform",
      operatingSystem: "Web",
      description,
      publisher: { "@id": `${SITE_URL}/#organization` },
      mainEntityOfPage: { "@id": `${SITE_URL}${path}#webpage` },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Lead scraping platform", item: `${SITE_URL}${path}` },
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

const comparisonRows = [
  ["Data collection model", "Single source or workflow", "Provider-defined database", "Supported actor library"],
  ["When data is collected", "On demand", "Provider refresh cycle", "On demand"],
  ["Review before CRM import", "Usually external", "Varies", "Built into the workflow"],
  ["Connected CRM records", "Separate setup", "Export or integration", "Companies, contacts and lists"],
  ["Sales execution", "Separate tools", "Usually separate", "Deals, tasks, quotes and contracts"],
  ["AI assistance", "Input or extraction help", "Search or enrichment help", "Actor guidance and workspace-aware actions"],
] as const;

export default function LeadScrapingPlatformPage() {
  return (
    <div className={sharedStyles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <MarketingHeader />
      <main>
        <nav className={sharedStyles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Lead scraping platform</span>
        </nav>

        <section className={`${sharedStyles.hero} ${styles.hero}`}>
          <div className={sharedStyles.heroCopy}>
            <span className={sharedStyles.eyebrow}>B2B LEAD SCRAPING PLATFORM</span>
            <h1>A lead scraping platform that turns public web data into sales workflows.</h1>
            <p>Choose a supported source, run targeted data collection, review structured results and move approved leads into a connected workspace without rebuilding the context in another tool.</p>
            <div className={sharedStyles.heroActions}>
              <Link href="/signup" className={sharedStyles.primaryButtonLarge}>Start free <ArrowRight size={18} /></Link>
              <Link href="/features/scraping" className={sharedStyles.secondaryButton}>Explore scraping</Link>
            </div>
            <div className={styles.heroProof}>
              <span><Check size={15} /> Guided actor inputs</span>
              <span><Check size={15} /> Review before import</span>
              <span><Check size={15} /> Connected CRM workflow</span>
            </div>
          </div>
          <figure className={sharedStyles.heroImage}>
            <div className={sharedStyles.windowBar}><span /><span /><span /><b>Bizcraw source library</b></div>
            <Image src="/landing/bizcraw-source-library-hero.png" alt="Bizcraw lead scraping platform source library with supported web scraping actors" width={1530} height={900} priority sizes="(max-width: 900px) 94vw, 610px" />
          </figure>
        </section>

        <section className={sharedStyles.benefitSection}>
          <div className={sharedStyles.sectionHeading}>
            <span className={sharedStyles.eyebrow}>FROM SOURCE TO SALES ACTION</span>
            <h2>Lead scraping is useful when the result has somewhere to go.</h2>
            <p>Bizcraw keeps collection, review and sales execution connected so a scraping run becomes an accountable workflow instead of another file to clean up later.</p>
          </div>
          <div className={sharedStyles.cardGrid}>
            <article><span className={sharedStyles.cardIcon}><Search size={22} /></span><h3>Choose the right source</h3><p>Browse supported actors, understand the required inputs and see the expected result structure before starting a run.</p></article>
            <article><span className={sharedStyles.cardIcon}><Database size={22} /></span><h3>Review structured results</h3><p>Inspect each result set and select the business or contact records that are useful for the target market.</p></article>
            <article><span className={sharedStyles.cardIcon}><Workflow size={22} /></span><h3>Continue inside CRM</h3><p>Move approved records into connected companies, contacts and lists, then continue with deals, tasks and commercial documents.</p></article>
          </div>
        </section>

        <section className={styles.productSection}>
          <div className={styles.productCopy}>
            <span className={sharedStyles.eyebrow}>A REVIEWABLE WORKFLOW</span>
            <h2>See the run, the records and the usage in one place.</h2>
            <p>Every scraping run keeps operational context attached: selected source, processing status, result volume and usage. Teams can inspect what happened before deciding which records should become active sales data.</p>
            <ul>
              <li><Check size={17} /> Run history and live processing status</li>
              <li><Check size={17} /> Record and usage visibility</li>
              <li><Check size={17} /> User-controlled CRM import</li>
            </ul>
          </div>
          <figure className={styles.productImage}>
            <div className={sharedStyles.windowBar}><span /><span /><span /><b>Scrape runs</b></div>
            <Image src="/landing/bizcraw-scrape-runs.png" alt="Bizcraw lead scraping run history with status, collected records and usage" width={1050} height={650} sizes="(max-width: 900px) 92vw, 620px" />
          </figure>
        </section>

        <section className={styles.comparisonSection}>
          <div className={sharedStyles.sectionHeading}>
            <span className={sharedStyles.eyebrow}>CHOOSE THE RIGHT CATEGORY</span>
            <h2>A scraper collects records. A platform carries the work forward.</h2>
            <p>Use this comparison to decide whether you need a focused extraction tool, a provider-maintained database or a connected scraping and sales workspace.</p>
          </div>
          <div className={styles.tableFrame}>
            <table>
              <thead><tr><th>Capability</th><th>Standalone scraper</th><th>Lead database</th><th>Bizcraw</th></tr></thead>
              <tbody>{comparisonRows.map(([capability, scraper, database, bizcraw]) => <tr key={capability}><th scope="row">{capability}</th><td>{scraper}</td><td>{database}</td><td><strong>{bizcraw}</strong></td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className={sharedStyles.useCaseSection}>
          <div><span className={sharedStyles.eyebrow}>BUILT FOR CONTROLLED PROSPECTING</span><h2>Use one workflow across common B2B research jobs.</h2><p>Start from a real market signal, keep the source visible and choose what deserves a next action.</p></div>
          <ul>
            <li><Check size={18} /> Build targeted local-business lists</li>
            <li><Check size={18} /> Research companies and public professional data</li>
            <li><Check size={18} /> Monitor jobs and market signals</li>
            <li><Check size={18} /> Organize approved records for follow-up</li>
          </ul>
        </section>

        <section className={styles.splitSection}>
          <figure className={styles.productImage}>
            <div className={sharedStyles.windowBar}><span /><span /><span /><b>Connected CRM</b></div>
            <Image src="/landing/bizcraw-crm-companies.png" alt="Bizcraw CRM with companies created from reviewed lead data" width={1050} height={650} sizes="(max-width: 900px) 92vw, 560px" />
          </figure>
          <div className={styles.productCopy}>
            <span className={sharedStyles.eyebrow}>AFTER THE SCRAPE</span>
            <h2>Keep lead data connected to the sales work it creates.</h2>
            <p>Approved data can continue into the workspace as companies, contacts and lists. From there, teams can manage opportunities, ownership, follow-up tasks, quotes and contracts without losing the original collection context.</p>
            <Link href="/data-to-crm" className={sharedStyles.secondaryButton}>Explore data to CRM <ArrowRight size={17} /></Link>
          </div>
        </section>

        <section className={styles.agentSection}>
          <span className={styles.agentIcon}><Bot size={24} /></span>
          <div><span className={sharedStyles.eyebrow}>AI-GUIDED SETUP</span><h2>Understand an actor before you run it.</h2><p>Bizcraw surfaces concise field guidance, examples and expected outputs for supported actors. The AI Agent can help explain unfamiliar inputs while workspace permissions and approval boundaries remain in effect.</p></div>
          <ShieldCheck size={40} aria-hidden="true" />
        </section>

        <section className={sharedStyles.faqSection}>
          <div className={sharedStyles.sectionHeading}><span className={sharedStyles.eyebrow}>LEAD SCRAPING PLATFORM FAQ</span><h2>Questions teams ask before choosing a platform.</h2></div>
          <div className={sharedStyles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className={sharedStyles.relatedSection}>
          <div><span className={sharedStyles.eyebrow}>EXPLORE THE WORKFLOW</span><h2>Go deeper before your first run.</h2></div>
          <div className={sharedStyles.relatedLinks}>
            <Link href="/web-scraping-for-lead-generation"><span>WORKFLOW GUIDE</span><b>Web scraping for lead generation</b><ArrowRight size={18} /></Link>
            <Link href="/scrape-business-leads"><span>USE CASE</span><b>How to scrape business leads</b><ArrowRight size={18} /></Link>
            <Link href="/google-maps-lead-scraper"><span>LOCAL BUSINESS DATA</span><b>Google Maps lead scraper</b><ArrowRight size={18} /></Link>
            <Link href="/integrations/apify"><span>INTEGRATION</span><b>Connect Apify actors to Bizcraw</b><ArrowRight size={18} /></Link>
          </div>
        </section>

        <section className={sharedStyles.cta}><span>START WITH A FREE WORKSPACE</span><h2>Build a repeatable path from public data to sales action.</h2><p>Choose a supported source, review the result and keep the next step connected.</p><Link href="/signup" className={sharedStyles.lightButton}>Start free <ArrowRight size={18} /></Link></section>
      </main>
      <MarketingFooter />
    </div>
  );
}
