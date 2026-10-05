import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { MarketingHubContent, MarketingInfoContent } from "@/content/marketing-pages";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-shell";
import { SITE_URL } from "@/lib/seo";
import styles from "@/styles/seo-page.module.css";

function JsonLd({ value }: { value: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, "\\u003c") }} />;
}

function PageBreadcrumb({ label }: { label: string }) {
  return <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{label}</span></nav>;
}

export function MarketingHubPage({ page }: { page: MarketingHubContent }) {
  const schema = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", name: page.title, description: page.description, url: `${SITE_URL}${page.path}`, isPartOf: { "@id": `${SITE_URL}/#website` } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: page.eyebrow, item: `${SITE_URL}${page.path}` },
    ] },
  ] };

  return <div className={styles.page}>
    <JsonLd value={schema} />
    <MarketingHeader />
    <main>
      <PageBreadcrumb label={page.eyebrow.charAt(0) + page.eyebrow.slice(1).toLowerCase()} />
      <section className={styles.hubHero}>
        <span className={styles.eyebrow}>{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
        <div className={styles.heroActions}><Link href="/signup" className={styles.primaryButtonLarge}>Start free <ArrowRight size={18} /></Link><Link href="/pricing" className={styles.secondaryButton}>View pricing</Link></div>
      </section>
      <section className={styles.hubSection}>
        <div className={styles.sectionHeading}><h2>{page.sectionTitle}</h2><p>{page.sectionText}</p></div>
        <div className={styles.hubGrid}>{page.cards.map((card, index) => <Link href={card.href} className={styles.hubCard} key={card.href}><span>{String(index + 1).padStart(2, "0")} · {card.label}</span><h2>{card.title}</h2><p>{card.description}</p><b>Explore <ArrowRight size={17} /></b></Link>)}</div>
      </section>
      <section className={styles.cta}><span>BUILD A CONNECTED WORKFLOW</span><h2>Start with fresh data. Keep the context through every next step.</h2><p>Create a free workspace and explore the workflow that fits your team.</p><Link href="/signup" className={styles.lightButton}>Create workspace <ArrowRight size={18} /></Link></section>
    </main>
    <MarketingFooter />
  </div>;
}

export function MarketingInfoPage({ page }: { page: MarketingInfoContent }) {
  const schema = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", name: page.title, description: page.description, url: `${SITE_URL}${page.path}`, isPartOf: { "@id": `${SITE_URL}/#website` } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: page.eyebrow, item: `${SITE_URL}${page.path}` },
    ] },
  ] };

  return <div className={styles.page}>
    <JsonLd value={schema} />
    <MarketingHeader />
    <main>
      <PageBreadcrumb label={page.eyebrow.charAt(0) + page.eyebrow.slice(1).toLowerCase()} />
      <section className={styles.infoHero}><span className={styles.eyebrow}>{page.eyebrow}</span><h1>{page.title}</h1><p>{page.intro}</p>{page.updated ? <small>Last updated: {page.updated}</small> : null}</section>
      <div className={styles.infoLayout}>
        <aside><b>On this page</b>{page.sections.map((section, index) => <a href={`#section-${index + 1}`} key={section.title}>{section.title}</a>)}</aside>
        <article>{page.sections.map((section, index) => <section id={`section-${index + 1}`} key={section.title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets ? <ul>{section.bullets.map((item) => <li key={item}><Check size={17} />{item}</li>)}</ul> : null}</section>)}</article>
      </div>
      <section className={styles.infoCta}><div><span className={styles.eyebrow}>NEXT STEP</span><h2>{page.path === "/contact" ? "Send your request to the Bizcraw team." : "Need help with a workspace or policy question?"}</h2><p>{page.path === "/contact" ? <>Email <a href="mailto:support@bizcraw.com">support@bizcraw.com</a> with the relevant request details above.</> : <>Open the contact page for support, privacy and security request details.</>}</p></div><Link href={page.path === "/contact" ? "mailto:support@bizcraw.com" : "/contact"} className={styles.primaryButtonLarge}>{page.path === "/contact" ? "Email support" : "Contact Bizcraw"}<ArrowRight size={18} /></Link></section>
    </main>
    <MarketingFooter />
  </div>;
}
