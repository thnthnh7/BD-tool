import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-shell";
import { PublicPricingGrid } from "@/components/marketing/public-pricing-grid";
import { createPublicMetadata } from "@/lib/seo";
import styles from "@/styles/seo-page.module.css";

export const metadata: Metadata = createPublicMetadata({
  title: "Bizcraw Pricing | Web Scraping and Sales Workspace",
  description: "Compare Bizcraw plans for web scraping, AI sales actions, CRM workflows, quotes, contracts and workspace seats.",
  path: "/pricing",
});

export default function PricingPage() {
  return <div className={styles.page}>
    <MarketingHeader />
    <main>
      <section className={styles.hero} style={{ gridTemplateColumns: "1fr", textAlign: "center", paddingBottom: 48 }}>
        <div className={styles.heroCopy} style={{ maxWidth: 820, margin: "auto" }}>
          <span className={styles.eyebrow}>PRICING</span>
          <h1>Choose the workspace your sales process needs.</h1>
          <p>Start free, then upgrade when your team needs more seats, AI actions or product modules. Scraping actor usage is shown separately with each supported source.</p>
        </div>
      </section>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 90px" }}><PublicPricingGrid /></section>
      <section className={styles.useCaseSection}>
        <div><span className={styles.eyebrow}>HOW BILLING WORKS</span><h2>Plans control workspace access and product capacity.</h2><p>Each plan defines seats, module permissions and monthly limits. External scraping usage can depend on the connected provider and actor configuration.</p></div>
        <ul><li>Workspace seats and module access</li><li>Monthly AI and document limits</li><li>Public plan pricing shown before signup</li><li>Upgrade from workspace billing</li></ul>
      </section>
      <section className={styles.cta}><span>START FREE</span><h2>Create the workspace first. Upgrade when the workflow proves useful.</h2><p>No credit card is required to create a free workspace.</p><Link href="/signup" className={styles.lightButton}>Create workspace <ArrowRight size={18} /></Link></section>
    </main>
    <MarketingFooter />
  </div>;
}
