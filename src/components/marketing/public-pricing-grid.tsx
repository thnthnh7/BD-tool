import Link from "next/link";
import { Check } from "lucide-react";
import { formatUsdFromCents } from "@/lib/money";
import { loadPublicPlans, planDetailHighlights, planIncludedModules } from "@/lib/public-plans";
import styles from "@/styles/pricing-page.module.css";

export async function PublicPricingGrid() {
  const plans = await loadPublicPlans();
  if (!plans.length) return <div className={styles.fallback}><h2>Plan details are temporarily unavailable</h2><p>Create a free workspace and review current plan availability inside Bizcraw.</p><Link href="/signup">Create workspace</Link></div>;

  return <div className={styles.grid}>{plans.map((plan) => {
    const featured = plan.badge.trim().length > 0;
    return <article key={plan.id} className={featured ? styles.featured : styles.card}>
      {featured ? <span className={styles.badge}>{plan.badge}</span> : null}
      <span className={styles.type}>{plan.isFree ? "Free forever" : "For growing teams"}</span>
      <h2>{plan.name}</h2>
      <div className={styles.price}>{plan.isFree ? "Free" : plan.usdMonthlyCents == null ? "Contact us" : formatUsdFromCents(plan.usdMonthlyCents)}{!plan.isFree && plan.usdMonthlyCents != null ? <small>/ month</small> : null}</div>
      <p>{plan.quotas.seats < 0 ? "Unlimited workspace seats." : `${plan.quotas.seats} workspace seat${plan.quotas.seats === 1 ? "" : "s"} included.`}</p>
      <div className={styles.featureSection}><strong>Plan details</strong><ul>{planDetailHighlights(plan).map((line) => <li key={line}><Check size={16} />{line}</li>)}</ul></div>
      <div className={styles.featureSection}><strong>Modules included</strong><ul>{planIncludedModules(plan).map((line) => <li key={line}><Check size={16} />{line}</li>)}</ul></div>
      <Link href={`/signup?plan=${encodeURIComponent(plan.id)}`} className={featured ? styles.primary : styles.secondary}>Choose {plan.name}</Link>
    </article>;
  })}</div>;
}
