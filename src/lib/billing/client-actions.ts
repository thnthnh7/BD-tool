"use server";

import {
  createCheckoutInvoice as createInvoice,
  initGatewayCheckout as initializeGateway,
  initiateSubscriptionCheckout as initiateSubscription,
} from "@/lib/billing/actions";

export async function createCheckoutInvoice(formData: FormData) {
  return createInvoice(formData);
}

export async function initGatewayCheckout(invoiceId: string) {
  return initializeGateway(invoiceId);
}

export async function initiateSubscriptionCheckout(formData: FormData) {
  return initiateSubscription(formData);
}
