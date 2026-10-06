import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppLogo } from "@/components/leadely/app-logo";
import styles from "@/styles/seo-page.module.css";

export function MarketingHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/#hero" aria-label="Bizcraw home" className={styles.logo}><AppLogo tagline /></Link>
        <nav aria-label="Primary navigation">
          <Link href="/features">Product</Link>
          <Link href="/solutions">Solutions</Link>
          <Link href="/guides">Guides</Link>
          <Link href="/integrations">Integrations</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <div className={styles.headerActions}>
          <Link href="/login" className={styles.signIn}>Sign in</Link>
          <Link href="/signup" className={styles.primaryButton}>Start free <ArrowRight size={16} /></Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerBrand}><AppLogo tagline /><p>Web scraping and AI sales workspace for lead discovery, CRM operations and sales execution.</p></div>
      <div><b>Product</b><Link href="/features">All features</Link><Link href="/features/scraping">Scraping runs</Link><Link href="/features/ai-sales-agent">AI sales agent</Link><Link href="/pricing">Pricing</Link></div>
      <div><b>Solutions</b><Link href="/solutions">All solutions</Link><Link href="/web-scraping">Web scraping</Link><Link href="/web-scraping-for-lead-generation">Lead generation</Link><Link href="/google-maps-lead-scraper">Google Maps leads</Link><Link href="/data-to-crm">Data to CRM</Link></div>
      <div><b>Resources</b><Link href="/guides">All guides</Link><Link href="/guides/how-to-build-a-prospect-list-with-web-scraping">Prospect list guide</Link><Link href="/guides/web-scraping-vs-data-enrichment">Scraping vs enrichment</Link><Link href="/integrations">Integrations</Link><Link href="/integrations/apify">Apify</Link></div>
      <div><b>Company</b><Link href="/what-is-bizcraw">What is Bizcraw?</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/security">Security</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
      <div className={styles.footerMeta}><span>© {new Date().getFullYear()} Bizcraw</span><span><Link href="/login">Sign in</Link> · Built for focused sales teams.</span></div>
    </footer>
  );
}
