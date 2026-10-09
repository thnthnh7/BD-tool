import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Database, Search, Workflow } from "lucide-react";
import type { SeoPageContent } from "@/content/seo-pages";
import { seoPages } from "@/content/seo-pages";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-shell";
import { SITE_URL } from "@/lib/seo";
import styles from "@/styles/seo-page.module.css";

export function SeoContentPage({ page }: { page: SeoPageContent }) {
  const breadcrumbItems = breadcrumbs(page.path);
  const faqSchema = {
    "@type": "FAQPage",
    mainEntity: page.faq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", name: page.title, description: page.description, url: `${SITE_URL}${page.path}`, isPartOf: { "@id": `${SITE_URL}/#website` } },
      ...(page.path.startsWith("/compare/") ? [{ "@type": "Article", headline: page.title.replace(" | Bizcraw", ""), description: page.description, mainEntityOfPage: `${SITE_URL}${page.path}`, dateModified: "2026-10-10", publisher: { "@id": `${SITE_URL}/#organization` } }] : []),
      { "@type": "BreadcrumbList", itemListElement: breadcrumbItems.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: `${SITE_URL}${item.path}` })) },
      faqSchema,
    ],
  };

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <MarketingHeader />
      <main>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">{breadcrumbItems.map((item, index) => index === breadcrumbItems.length - 1 ? <span key={item.path} aria-current="page">{item.name}</span> : <span className={styles.breadcrumbStep} key={item.path}><Link href={item.path}>{item.name}</Link><i aria-hidden="true">/</i></span>)}</nav>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{page.eyebrow}</span>
            <h1>{page.title.replace(" | Bizcraw", "")}</h1>
            <p>{page.intro}</p>
            <div className={styles.heroActions}><Link href="/signup" className={styles.primaryButtonLarge}>Start free <ArrowRight size={18} /></Link><Link href="/features/scraping" className={styles.secondaryButton}>Explore scraping</Link></div>
          </div>
          <figure className={styles.heroImage}><div className={styles.windowBar}><span /><span /><span /><b>Bizcraw workspace</b></div><Image src={page.image} alt={page.imageAlt} width={1530} height={900} priority sizes="(max-width: 900px) 94vw, 610px" /></figure>
        </section>

        <section className={styles.benefitSection}>
          <div className={styles.sectionHeading}><span className={styles.eyebrow}>WHY IT MATTERS</span><h2>Move from public data to useful sales context.</h2><p>{page.description}</p></div>
          <div className={styles.cardGrid}>{page.benefits.map((benefit, index) => <article key={benefit.title}><span className={styles.cardIcon}>{[Search, Database, Workflow].map((Icon, iconIndex) => iconIndex === index ? <Icon key={benefit.title} size={22} /> : null)}</span><h3>{benefit.title}</h3><p>{benefit.text}</p></article>)}</div>
        </section>

        <section className={styles.processSection}>
          <div className={styles.sectionHeading}><span className={styles.eyebrow}>HOW IT WORKS</span><h2>A reviewable workflow from source to action.</h2></div>
          <ol className={styles.steps}>{page.steps.map((step, index) => <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
        </section>

        <section className={styles.useCaseSection}>
          <div><span className={styles.eyebrow}>USE CASES</span><h2>Built for focused research and follow-up.</h2><p>Use the same controlled workflow across common sales and market-research jobs.</p></div>
          <ul>{page.useCases.map((item) => <li key={item}><Check size={18} />{item}</li>)}</ul>
        </section>

        <section className={styles.faqSection}>
          <div className={styles.sectionHeading}><span className={styles.eyebrow}>QUESTIONS</span><h2>What teams need to know.</h2></div>
          <div className={styles.faqList}>{page.faq.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
        </section>

        {page.sources?.length ? <section className={styles.sourceSection}><span className={styles.eyebrow}>SOURCES</span><h2>Reference material used for this comparison.</h2><ul>{page.sources.map((source) => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{source.label}<ArrowRight size={16} /></a></li>)}</ul></section> : null}

        <section className={styles.relatedSection}><div><span className={styles.eyebrow}>EXPLORE NEXT</span><h2>Continue through the workflow.</h2></div><div className={styles.relatedLinks}>{page.related.map((key) => { const related = seoPages[key]; return related ? <Link key={key} href={related.path}><span>{related.eyebrow}</span><b>{related.title.replace(" | Bizcraw", "")}</b><ArrowRight size={18} /></Link> : key === "pricing" ? <Link key={key} href="/pricing"><span>PLANS</span><b>Bizcraw pricing</b><ArrowRight size={18} /></Link> : key === "mcp" ? <Link key={key} href="/mcp"><span>AI CONNECTIVITY</span><b>Bizcraw MCP server</b><ArrowRight size={18} /></Link> : null; })}</div></section>

        <section className={styles.cta}><span>START WITH A FREE WORKSPACE</span><h2>Collect better data and keep the next action attached.</h2><p>Build a repeatable path from scraping to sales execution.</p><Link href="/signup" className={styles.lightButton}>Create workspace <ArrowRight size={18} /></Link></section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function breadcrumbs(path: string) {
  const labels: Record<string, string> = { features: "Features", guides: "Guides", integrations: "Integrations" };
  const parts = path.split("/").filter(Boolean);
  const items = [{ name: "Home", path: "/" }];
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    items.push({ name: labels[part] ?? part.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "), path: current });
  }
  return items;
}
