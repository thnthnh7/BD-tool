import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { CAPABILITY_OPTIONS, MODULE_GROUPS, type PlanFeatureKey } from "@/lib/module-catalog";
import { formatUsdFromCents } from "@/lib/money";
import { loadPublicPlans } from "@/lib/public-plans";
import styles from "@/styles/pricing-page.module.css";

export async function PublicPricingGrid() {
  const plans = await loadPublicPlans();
  if (!plans.length) return <div className={styles.fallback}><h2>Plan details are temporarily unavailable</h2><p>Create a free workspace and review current plan availability inside Bizcraw.</p><Link href="/signup">Create workspace</Link></div>;

  const detailRows = [
    ["Workspace seats", (plan: (typeof plans)[number]) => plan.quotas.seats < 0 ? "Unlimited" : String(plan.quotas.seats)],
    ["Quotes / month", (plan: (typeof plans)[number]) => plan.quotas.quotes_per_month < 0 ? "Unlimited" : String(plan.quotas.quotes_per_month)],
    ["Installed sources", () => "Unlimited"],
    ["Scrape runs", () => "Unlimited"],
    ["AI actions", () => "Unlimited"],
    ["Concurrent scrapes", (plan: (typeof plans)[number]) => String(plan.quotas.concurrent_scrape_runs)],
    ["Raw data retention", (plan: (typeof plans)[number]) => `${plan.quotas.raw_data_retention_days} days`],
    ["Free trial", (plan: (typeof plans)[number]) => plan.trialDays > 0 ? `${plan.trialDays} days` : "—"],
  ] as const;

  return <div className={`${styles.tableShell} ${plans.length === 1 ? styles.singlePlanTable : ""}`}><table className={styles.comparison}>
    <thead><tr><th scope="col"><span>Compare plans</span><small>Limits and included modules</small></th>{plans.map((plan) => {
      const featured = plan.slug === "pro";
      return <th scope="col" key={plan.id} className={featured ? styles.featuredColumn : undefined}>
        <h2>{plan.name}</h2>
        <div className={styles.price}>{plan.isFree ? "$0" : plan.usdMonthlyCents == null ? "Contact us" : formatUsdFromCents(plan.usdMonthlyCents)}{plan.usdMonthlyCents != null ? <small>/ month</small> : null}</div>
        <Link href={`/signup?plan=${encodeURIComponent(plan.id)}`} className={featured ? styles.primary : styles.secondary}>Choose {plan.name}</Link>
      </th>;
    })}</tr></thead>
    <tbody>
      <tr className={styles.groupRow}><th colSpan={plans.length + 1}>Plan details</th></tr>
      {detailRows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{plans.map((plan) => <td key={plan.id}>{value(plan)}</td>)}</tr>)}
      {MODULE_GROUPS.map((group) => <PricingFeatureRows key={group.id} label={group.label} rows={group.modules} plans={plans} />)}
      <PricingFeatureRows label="Advanced capabilities" rows={CAPABILITY_OPTIONS} plans={plans} />
    </tbody>
  </table></div>;
}

function PricingFeatureRows({ label, rows, plans }: { label: string; rows: readonly (readonly [PlanFeatureKey, string])[]; plans: Awaited<ReturnType<typeof loadPublicPlans>> }) {
  return <>
    <tr className={styles.groupRow}><th colSpan={plans.length + 1}>{label}</th></tr>
    {rows.map(([key, featureLabel]) => <tr key={key}><th scope="row">{featureLabel}</th>{plans.map((plan) => <td key={plan.id}>{plan.features[key] ? <span className={styles.included}><Check size={17} /><span className={styles.srOnly}>Included</span></span> : <span className={styles.notIncluded}><Minus size={17} /><span className={styles.srOnly}>Not included</span></span>}</td>)}</tr>)}
  </>;
}
