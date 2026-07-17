"use client";

import { defaultData } from "./default-data";
import { createId } from "./ids";
import type { AppData, Client, Quote } from "./types";

const STORAGE_KEY = "csj-bd-tool-data-v1";

export { createId, createPublicId } from "./ids";

function normalizeClient(client: Client): Client {
  return {
    ...client,
    taxCode: client.taxCode || "",
    address: client.address || "",
    representativeTitle: client.representativeTitle || "",
    authorizationDoc: client.authorizationDoc || "",
    logoUrl: client.logoUrl || "",
  };
}

function normalizeQuote(quote: Quote, settings = defaultData.settings): Quote {
  return {
    ...quote,
    deliverables: quote.deliverables || [],
    contractNumber: quote.contractNumber || "",
    paymentMilestones: quote.paymentMilestones?.length
      ? quote.paymentMilestones
      : [
          {
            id: createId("pay"),
            label: "Đợt 1",
            description: "Đặt cọc khởi động dự án",
            percent: 70,
            trigger: "Sau khi ký hợp đồng",
          },
          {
            id: createId("pay"),
            label: "Đợt 2",
            description: "Nghiệm thu hoàn chỉnh",
            percent: 30,
            trigger: "Sau khi nghiệm thu",
          },
        ],
    techStack: quote.techStack?.length ? quote.techStack : ["React.js", "Next.js", "Tailwind CSS", "PostgreSQL"],
    warrantyMonths: quote.warrantyMonths ?? settings.defaultWarrantyMonths,
    maintenanceFeeMonthly: quote.maintenanceFeeMonthly ?? settings.defaultMaintenanceFee,
  };
}

export function loadAppData(): AppData {
  if (typeof window === "undefined") {
    return defaultData;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultData;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const settings = { ...defaultData.settings, ...parsed.settings };
    return {
      settings,
      clients: (parsed.clients ?? []).map(normalizeClient),
      modules: parsed.modules?.length ? parsed.modules : defaultData.modules,
      quotes: (parsed.quotes ?? []).map((quote) => normalizeQuote(quote, settings)),
    };
  } catch {
    return defaultData;
  }
}

export function saveAppData(data: AppData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetAppData() {
  window.localStorage.removeItem(STORAGE_KEY);
}
