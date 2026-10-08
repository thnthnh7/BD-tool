"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Checkbox, Collapse, Group, Image, SegmentedControl, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { Building2, Check, ChevronRight, CreditCard, Receipt, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/leadely/empty-state";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { createCheckoutInvoice, initGatewayCheckout, initiateSubscriptionCheckout, updateSubscriptionCancellation } from "@/lib/billing/client-actions";
import { billingMarketOptions, convertUsdCents, formatMinorAmount, marketForLocale } from "@/lib/billing/localization";
import type { AppLocale } from "@/i18n/config";
import type { ParsedPlan } from "@/lib/entitlements";
import classes from "@/styles/billing.module.css";

type Invoice = { id: string; payment_code: string; amount: number; currency?: string | null; provider?: string | null; provider_status?: string | null; hosted_invoice_url?: string | null; status: string; billing_interval: string; created_at: string };
type ProviderPrice = { plan_id: string; provider: string; billing_interval: string; currency: string; amount: number };
type PaymentMethod = "stripe" | "paypal" | "sepay";

function invoiceAmount(invoice: Pick<Invoice, "amount" | "currency">, locale: AppLocale) {
  return formatMinorAmount(invoice.amount, invoice.currency || "VND", locale);
}

function Brand({ name }: { name: PaymentMethod }) {
  if (name === "stripe") return <span className={`${classes.brand} ${classes.stripe}`}>stripe</span>;
  if (name === "paypal") return <span className={`${classes.brand} ${classes.paypal}`}><i>P</i><span>Pay</span><strong>Pal</strong></span>;
  return <span className={`${classes.brand} ${classes.sepay}`}><Building2 size={17} />SePay</span>;
}

export function BillingPanel({ plans, providerPrices, usdRates, locale, invoices, currentPlanId, canPay, qrUrl, subscription, providers, requestedPlanId }: {
  plans: ParsedPlan[];
  providerPrices: ProviderPrice[];
  usdRates: Record<string, number>;
  locale: AppLocale;
  invoices: Invoice[];
  currentPlanId: string;
  canPay: boolean;
  qrUrl?: string;
  subscription?: { provider?: string; status: string; current_period_end: string; cancel_at_period_end?: boolean; billing_interval?: string } | null;
  providers: { stripe: boolean; paypal: boolean };
  requestedPlanId?: string;
}) {
  const t = useTranslations("Billing");
  const paidPlans = useMemo(() => plans.filter((plan) => !plan.isFree && plan.isPublic), [plans]);
  const initialMarket = marketForLocale(locale);
  const pricedPlanIds = useMemo(() => new Set(providerPrices.filter((price) => price.currency.toUpperCase() === "USD").map((price) => price.plan_id)), [providerPrices]);
  const requestedPaidPlanId = paidPlans.some((plan) => plan.id === requestedPlanId) && requestedPlanId && pricedPlanIds.has(requestedPlanId) ? requestedPlanId : "";
  const initialPlanId = requestedPaidPlanId || (pricedPlanIds.has(currentPlanId) ? currentPlanId : paidPlans.find((plan) => pricedPlanIds.has(plan.id))?.id || paidPlans[0]?.id || "");
  const [editing, setEditing] = useState(Boolean(requestedPaidPlanId));
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [country, setCountry] = useState(initialMarket.country);
  const [currency, setCurrency] = useState(initialMarket.currency);
  const [method, setMethod] = useState<PaymentMethod>(providers.stripe ? "stripe" : providers.paypal ? "paypal" : "sepay");
  const [error, setError] = useState("");
  const current = plans.find((plan) => plan.id === currentPlanId);
  const selectedPlan = paidPlans.find((plan) => plan.id === selectedPlanId);
  const pending = invoices.find((item) => item.status === "pending");
  const pendingProvider = pending?.provider || "sepay";

  function usdPrice(planId?: string, cycle: "monthly" | "yearly" = interval) {
    if (!planId) return null;
    return providerPrices.find((price) => price.plan_id === planId && price.billing_interval === cycle && price.currency.toUpperCase() === "USD") || null;
  }
  function displayPrice(planId?: string, cycle: "monthly" | "yearly" = interval) {
    const price = usdPrice(planId, cycle);
    if (!price) return null;
    return formatMinorAmount(convertUsdCents(price.amount, currency, usdRates), currency, locale);
  }

  async function checkout(formData: FormData) { setError(""); const result = await createCheckoutInvoice(formData); if (result.error) setError(result.error); }
  async function gateway(invoiceId: string) { const result = await initGatewayCheckout(invoiceId); if (result.error) setError(result.error); if (result.url) window.location.href = result.url; }
  async function subscriptionCheckout(formData: FormData) { setError(""); const result = await initiateSubscriptionCheckout(formData); if (result.error) setError(result.error); if (result.url) window.location.href = result.url; }
  async function subscriptionControl(formData: FormData) { setError(""); const result = await updateSubscriptionCancellation(formData); if (result.error) setError(result.error); }

  const methods: Array<{ id: PaymentMethod; label: string; description: string; enabled: boolean }> = [
    { id: "stripe", label: t("card"), description: t("cardDescription"), enabled: providers.stripe },
    { id: "paypal", label: "PayPal", description: t("paypalDescription"), enabled: providers.paypal },
    { id: "sepay", label: t("bankTransfer"), description: t("bankTransferDescription"), enabled: country === "VN" },
  ];

  function changeCountry(nextCountry: string) {
    const market = billingMarketOptions.find((item) => item.country === nextCountry) || initialMarket;
    setCountry(market.country); setCurrency(market.currency);
    if (market.country !== "VN" && method === "sepay") setMethod(providers.stripe ? "stripe" : "paypal");
  }

  const selectedUsd = usdPrice(selectedPlanId);
  const localTotal = displayPrice(selectedPlanId);
  const currentCycle = subscription?.billing_interval === "yearly" ? "yearly" : "monthly";

  return <Stack gap="md" className={classes.page}>
    <PageHeader title={t("title")} subtitle={t("subtitle")} />
    <SectionPanel><div className={classes.summaryRow}>
      <div><Group gap={7}><Text size="xs" c="dimmed">{t("currentPlan")}</Text>{subscription ? <span className={classes.planStatus} data-status={subscription.status}><i />{subscription.status.replace(/_/g, " ")}</span> : null}</Group><Text fw={750} fz="lg" mt={2}>{current?.name || "—"}</Text></div>
      <div className={classes.summaryItem}><Text size="xs" c="dimmed">{t("price")}</Text><Text size="sm" fw={650}>{current?.isFree ? t("free") : displayPrice(current?.id, currentCycle) || t("notConfigured")}</Text></div>
      {subscription ? <><div className={classes.summaryItem}><Text size="xs" c="dimmed">{t("method")}</Text><Text size="sm" fw={650}>{subscription.provider?.toUpperCase() || "SEPAY"}</Text></div><div className={classes.summaryItem}><Text size="xs" c="dimmed">{subscription.cancel_at_period_end ? t("ends") : t("renews")}</Text><Text size="sm" fw={650}>{new Date(subscription.current_period_end).toLocaleDateString(locale)}</Text></div></> : null}
      {canPay ? <Button size="xs" variant={editing ? "light" : "filled"} onClick={() => setEditing((value) => !value)}>{editing ? t("close") : t("changePlan")}</Button> : null}
      {canPay && subscription && ["stripe", "paypal"].includes(subscription.provider || "") ? <form action={subscriptionControl}>
        <input type="hidden" name="mode" value={subscription.cancel_at_period_end ? "resume" : "cancel"} />
        <Button type="submit" size="xs" variant="subtle" color={subscription.cancel_at_period_end ? "teal" : "red"} disabled={subscription.provider === "paypal" && subscription.cancel_at_period_end}>
          {subscription.cancel_at_period_end ? "Resume subscription" : "Cancel at period end"}
        </Button>
      </form> : null}
    </div></SectionPanel>

    {canPay ? <Collapse expanded={editing}><SectionPanel title={t("choosePlan")}>
      <div className={classes.checkoutToolbar}><SegmentedControl value={interval} onChange={(value) => setInterval(value === "yearly" ? "yearly" : "monthly")} data={[{ value: "monthly", label: t("monthly") }, { value: "yearly", label: t("yearly") }]} /><Select label={t("billingCountry")} value={country} onChange={(value) => value && changeCountry(value)} searchable placeholder={t("searchCountryCurrency")} nothingFoundMessage={t("countryNotFound")} data={billingMarketOptions.map((item) => ({ value: item.country, label: `${item.countryName} · ${item.currency}` }))} /></div>
      <div className={classes.planList}>{paidPlans.map((plan) => { const chosen = plan.id === selectedPlanId; const available = Boolean(usdPrice(plan.id)); return <button type="button" key={plan.id} disabled={!available} className={`${classes.planRow} ${chosen ? classes.planSelected : ""}`} onClick={() => setSelectedPlanId(plan.id)}><span><b>{plan.name}</b><small>{plan.quotas.seats < 0 ? t("unlimitedSeats") : t("seatCount", { count: plan.quotas.seats })}</small></span><strong>{displayPrice(plan.id) || t("notConfigured")}{available ? <small>/{interval === "yearly" ? t("year") : t("month")}</small> : null}</strong>{chosen ? <Check size={16} /> : <ChevronRight size={16} />}</button>; })}</div>
      <div className={classes.checkoutGrid}>
        <div><Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6}>{t("paymentMethod")}</Text><div className={classes.methodList}>{methods.map((item) => <button key={item.id} type="button" disabled={!item.enabled} className={`${classes.methodRow} ${method === item.id ? classes.methodSelected : ""}`} onClick={() => setMethod(item.id)}><Brand name={item.id} /><span className={classes.methodCopy}><b>{item.label}</b><small>{item.description}</small></span>{!item.enabled ? <span className={classes.notReady}>{t("unavailable")}</span> : method === item.id ? <Check size={16} /> : <ChevronRight size={16} />}</button>)}</div></div>
        <div className={classes.orderSummary}><Text fw={700}>{t("orderSummary")}</Text><div><span>{selectedPlan?.name || t("plan")} · {interval === "yearly" ? t("yearly") : t("monthly")}</span><strong>{localTotal || "—"}</strong></div><div><span>{t("estimatedTax")}</span><span>{t("calculatedAtCheckout")}</span></div><div className={classes.orderTotal}><span>{t("estimatedTotal")}</span><strong>{localTotal || "—"}</strong></div>
          {currency !== "USD" && selectedUsd ? <Text size="xs" c="dimmed">{t("exchangeEstimate", { amount: formatMinorAmount(selectedUsd.amount, "USD", locale) })}</Text> : null}
          <Group gap={6} mt="sm"><ShieldCheck size={14} /><Text size="xs" c="dimmed">{t("secureCheckout")}</Text></Group>
          {method === "sepay" ? <form action={checkout} className={classes.summaryForm}><input type="hidden" name="planId" value={selectedPlanId} /><input type="hidden" name="interval" value={interval} /><input type="hidden" name="billingCountry" value={country} /><details className={classes.vat}><summary>{t("businessVatInvoice")}</summary><div className={classes.vatFields}><Checkbox name="vat" label={t("requestVatInvoice")} /><TextInput name="vatTaxCode" placeholder={t("taxCode")} size="xs" /></div></details><Button type="submit" fullWidth>{t("continuePayment")}</Button></form> : <form action={subscriptionCheckout} className={classes.summaryForm}><input type="hidden" name="planId" value={selectedPlanId} /><input type="hidden" name="interval" value={interval} /><input type="hidden" name="provider" value={method} /><input type="hidden" name="billingCountry" value={country} /><input type="hidden" name="displayCurrency" value={currency} /><Button type="submit" fullWidth leftSection={<CreditCard size={15} />}>{currentPlanId === selectedPlanId ? t("renewPlan") : t("upgradeTo", { plan: selectedPlan?.name || t("plan") })}</Button></form>}
        </div>
      </div>{error ? <Alert color="red" mt="md">{error}</Alert> : null}
    </SectionPanel></Collapse> : <Text size="sm">{t("ownerOnly")}</Text>}

    {pending ? <details className={classes.disclosure} open><summary><span>{t("pendingPayment", { method: pendingProvider === "sepay" ? t("bankTransfer").toLowerCase() : pendingProvider })} · {pending.payment_code}</span><strong>{invoiceAmount(pending, locale)}</strong></summary><div className={classes.pendingBody}><div>{pendingProvider === "sepay" ? <><Text size="sm">{t("transferNote")}: <b>{pending.payment_code}</b></Text><Button variant="default" size="xs" mt="sm" onClick={() => gateway(pending.id)}>{t("cardNapas")}</Button></> : <><Text size="sm">{t("completeCheckout")}</Text>{pending.hosted_invoice_url ? <Button component="a" href={pending.hosted_invoice_url} size="xs" mt="sm">{t("resumeCheckout")}</Button> : null}</>}</div>{pendingProvider === "sepay" && qrUrl ? <Image src={qrUrl} alt="VietQR" w={112} h={112} radius="md" /> : null}</div></details> : null}
    <details className={classes.disclosure}><summary><span>{t("paymentHistory")}</span><span className={classes.count}>{invoices.length}</span></summary><div className={classes.tableWrap}>{invoices.length === 0 ? <EmptyState compact icon={<Receipt size={14} />} title={t("noPayments")} description={t("noPaymentsHelp")} /> : <Table><Table.Thead><Table.Tr><Table.Th>{t("reference")}</Table.Th><Table.Th>{t("method")}</Table.Th><Table.Th ta="right">{t("amount")}</Table.Th><Table.Th>{t("status")}</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{invoices.map((invoice) => <Table.Tr key={invoice.id}><Table.Td>{invoice.payment_code}</Table.Td><Table.Td tt="capitalize">{invoice.provider || "sepay"}</Table.Td><Table.Td ta="right">{invoiceAmount(invoice, locale)}</Table.Td><Table.Td><StatusBadge status={invoice.status} /></Table.Td></Table.Tr>)}</Table.Tbody></Table>}</div></details>
  </Stack>;
}
