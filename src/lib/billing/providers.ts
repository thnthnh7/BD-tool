import { createHmac, timingSafeEqual } from "crypto";

export type BillingProvider = "stripe" | "paypal" | "sepay";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function createStripeSubscriptionCheckout(input: {
  priceId: string;
  workspaceId: string;
  planId: string;
  interval: "monthly" | "yearly";
  invoiceId: string;
  customerId?: string | null;
  customerEmail?: string | null;
  locale?: string;
  billingCountry?: string;
}) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe chưa được cấu hình.");

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", input.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${siteUrl()}/app/billing?result=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${siteUrl()}/app/billing?result=cancel`);
  params.set("client_reference_id", input.workspaceId);
  params.set("metadata[workspace_id]", input.workspaceId);
  params.set("metadata[plan_id]", input.planId);
  params.set("metadata[interval]", input.interval);
  params.set("metadata[invoice_id]", input.invoiceId);
  params.set("subscription_data[metadata][workspace_id]", input.workspaceId);
  params.set("subscription_data[metadata][plan_id]", input.planId);
  params.set("subscription_data[metadata][interval]", input.interval);
  params.set("subscription_data[metadata][invoice_id]", input.invoiceId);
  params.set("automatic_tax[enabled]", "true");
  params.set("billing_address_collection", "required");
  params.set("tax_id_collection[enabled]", "true");
  params.set("adaptive_pricing[enabled]", "true");
  params.set("locale", input.locale || "auto");
  if (input.billingCountry) params.set("metadata[billing_country]", input.billingCountry);
  if (input.customerId) params.set("customer", input.customerId);
  else if (input.customerEmail) params.set("customer_email", input.customerEmail);
  if (input.customerId) params.set("customer_update[address]", "auto");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const json = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !json.url || !json.id) throw new Error(json.error?.message || "Không tạo được Stripe Checkout.");
  return { id: json.id, url: json.url };
}

async function paypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PayPal chưa được cấu hình.");
  const base = process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !json.access_token) throw new Error(json.error_description || "Không xác thực được PayPal.");
  return { token: json.access_token, base };
}

export async function createPayPalSubscription(input: {
  externalPlanId: string;
  workspaceId: string;
  planId: string;
  interval: "monthly" | "yearly";
  invoiceId: string;
  billingCountry?: string;
}) {
  const { token, base } = await paypalAccessToken();
  const response = await fetch(`${base}/v1/billing/subscriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      plan_id: input.externalPlanId,
      custom_id: [input.workspaceId, input.planId, input.interval, input.invoiceId, input.billingCountry || ""].join("|"),
      application_context: {
        brand_name: "Bizcraw",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${siteUrl()}/app/billing?result=success&provider=paypal`,
        cancel_url: `${siteUrl()}/app/billing?result=cancel&provider=paypal`,
      },
    }),
  });
  const json = (await response.json()) as {
    id?: string;
    links?: Array<{ rel: string; href: string }>;
    message?: string;
    details?: Array<{ description?: string }>;
  };
  const approvalUrl = json.links?.find((link) => link.rel === "approve")?.href;
  if (!response.ok || !json.id || !approvalUrl) {
    throw new Error(json.details?.[0]?.description || json.message || "Không tạo được PayPal Subscription.");
  }
  return { id: json.id, url: approvalUrl };
}

export function verifyStripeWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=", 2)));
  const timestamp = parts.t;
  const supplied = parts.v1;
  if (!timestamp || !supplied || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(supplied, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function verifyPayPalWebhook(headers: Headers, event: unknown) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const { token, base } = await paypalAccessToken();
  const response = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  const json = (await response.json()) as { verification_status?: string };
  return response.ok && json.verification_status === "SUCCESS";
}

export async function loadStripeSubscription(id: string) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe chưa được cấu hình.");
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) throw new Error("Không đọc được Stripe Subscription.");
  return response.json() as Promise<Record<string, unknown>>;
}

export async function loadPayPalSubscription(id: string) {
  const { token, base } = await paypalAccessToken();
  const response = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Không đọc được PayPal Subscription.");
  return response.json() as Promise<Record<string, unknown>>;
}

export async function syncStripeCatalogPrice(input: {
  planName: string;
  interval: "monthly" | "yearly";
  amount: number;
  existingProductId?: string | null;
}) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe chưa được kết nối.");
  let productId = input.existingProductId || "";
  if (!productId) {
    const productParams = new URLSearchParams({ name: `Bizcraw ${input.planName}` });
    const productResponse = await fetch("https://api.stripe.com/v1/products", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: productParams,
    });
    const product = await productResponse.json() as { id?: string; error?: { message?: string } };
    if (!productResponse.ok || !product.id) throw new Error(product.error?.message || "Không tạo được Stripe Product.");
    productId = product.id;
  }
  const priceParams = new URLSearchParams({
    product: productId,
    currency: "usd",
    unit_amount: String(input.amount),
    "recurring[interval]": input.interval === "yearly" ? "year" : "month",
  });
  const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: priceParams,
  });
  const price = await priceResponse.json() as { id?: string; error?: { message?: string } };
  if (!priceResponse.ok || !price.id) throw new Error(price.error?.message || "Không tạo được Stripe Price.");
  return { productId, priceId: price.id };
}

export async function syncPayPalCatalogPlan(input: {
  planName: string;
  interval: "monthly" | "yearly";
  amount: number;
  existingProductId?: string | null;
}) {
  const { token, base } = await paypalAccessToken();
  let productId = input.existingProductId || "";
  if (!productId) {
    const productResponse = await fetch(`${base}/v1/catalogs/products`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": crypto.randomUUID() },
      body: JSON.stringify({ name: `Bizcraw ${input.planName}`, type: "SERVICE", category: "SOFTWARE" }),
    });
    const product = await productResponse.json() as { id?: string; message?: string };
    if (!productResponse.ok || !product.id) throw new Error(product.message || "Không tạo được PayPal Product.");
    productId = product.id;
  }
  const dollars = (input.amount / 100).toFixed(2);
  const planResponse = await fetch(`${base}/v1/billing/plans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": crypto.randomUUID() },
    body: JSON.stringify({
      product_id: productId,
      name: `${input.planName} ${input.interval}`,
      status: "ACTIVE",
      billing_cycles: [{
        frequency: { interval_unit: input.interval === "yearly" ? "YEAR" : "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: dollars, currency_code: "USD" } },
      }],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
    }),
  });
  const plan = await planResponse.json() as { id?: string; message?: string; details?: Array<{ description?: string }> };
  if (!planResponse.ok || !plan.id) throw new Error(plan.details?.[0]?.description || plan.message || "Không tạo được PayPal Plan.");
  return { productId, priceId: plan.id };
}
