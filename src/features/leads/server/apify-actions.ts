"use server";

import {
  refreshApifyConnectionAction as refreshConnection,
  saveApifyTokenAction as saveToken,
  unlinkApifyConnectionAction as unlinkConnection,
} from "@/features/leads/server/apify-connection";

export async function saveApifyTokenAction(formData: FormData) {
  return saveToken(formData);
}

export async function refreshApifyConnectionAction(formData: FormData) {
  return refreshConnection(formData);
}

export async function unlinkApifyConnectionAction(formData: FormData) {
  return unlinkConnection(formData);
}
