export const DATA_PROVIDERS = [
  {
    id: "apify",
    name: "Apify",
    status: "available",
    capabilities: ["catalog", "actor_runs", "datasets", "webhooks", "usage_cost"],
  },
  {
    id: "outscraper",
    name: "Outscraper",
    status: "planned",
    capabilities: ["places", "reviews", "contacts"],
  },
  {
    id: "serper",
    name: "Serper",
    status: "planned",
    capabilities: ["search_results"],
  },
  {
    id: "custom_webhook",
    name: "Custom webhook",
    status: "planned",
    capabilities: ["push_records"],
  },
] as const;

export type DataProviderId = (typeof DATA_PROVIDERS)[number]["id"];
export type DataProviderCapability = (typeof DATA_PROVIDERS)[number]["capabilities"][number];

export type DataProviderRun = {
  provider: DataProviderId;
  runId: string;
  datasetId: string | null;
  status: string;
  usageUsd: number | null;
};

export interface DataProviderAdapter {
  readonly id: DataProviderId;
  start(input: { source: string; payload: Record<string, unknown>; webhookUrl: string; credential: string }): Promise<DataProviderRun>;
  status(input: { runId: string; credential: string }): Promise<DataProviderRun>;
  abort(input: { runId: string; credential: string }): Promise<DataProviderRun>;
  dataset(input: { datasetId: string; credential: string }): Promise<unknown[]>;
}

