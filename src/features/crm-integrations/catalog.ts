export const crmProviders = [
  { id: "hubspot", name: "HubSpot", initials: "HS", description: "Contacts, companies, deals, activities and custom objects.", priority: "Recommended", auth: "OAuth 2.0", credentials: ["HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET"], accountInput: "HubSpot account label", capabilities: ["Webhooks", "Bulk read", "Custom properties"] },
  { id: "salesforce", name: "Salesforce", initials: "SF", description: "Leads, accounts, contacts, opportunities and activities.", priority: "Enterprise", auth: "OAuth 2.0 · External Client App", credentials: ["SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"], accountInput: "Salesforce organization", capabilities: ["Change Data Capture", "Bulk API", "Custom objects"] },
  { id: "dynamics_365", name: "Microsoft Dynamics 365", initials: "D365", description: "Dataverse leads, contacts, accounts and opportunities.", priority: "Enterprise", auth: "Microsoft Entra OAuth 2.0", credentials: ["DYNAMICS_CLIENT_ID", "DYNAMICS_CLIENT_SECRET"], accountInput: "Dataverse environment URL", capabilities: ["OData delta", "Web API", "Custom tables"] },
  { id: "zoho", name: "Zoho CRM", initials: "ZO", description: "Leads, contacts, accounts, deals, tasks and products.", priority: "Popular", auth: "OAuth 2.0 · regional data center", credentials: ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET"], accountInput: "Zoho organization / data center", capabilities: ["Notifications", "Bulk API", "Custom modules"] },
  { id: "pipedrive", name: "Pipedrive", initials: "PD", description: "Persons, organizations, leads, deals and activities.", priority: "Popular", auth: "OAuth 2.0", credentials: ["PIPEDRIVE_CLIENT_ID", "PIPEDRIVE_CLIENT_SECRET"], accountInput: "Pipedrive company", capabilities: ["Webhooks", "REST v2", "Custom fields"] },
  { id: "freshsales", name: "Freshsales", initials: "FS", description: "Contacts, accounts, deals and sales activities.", priority: "Next", auth: "Freshworks OAuth 2.0", credentials: ["FRESHSALES_CLIENT_ID", "FRESHSALES_CLIENT_SECRET"], accountInput: "Freshworks organization URL", capabilities: ["REST API", "Custom modules", "30-minute access token"] },
  { id: "monday", name: "monday Sales CRM", initials: "MO", description: "Board-based contacts, accounts and deals with field mapping.", priority: "Next", auth: "OAuth 2.1", credentials: ["MONDAY_CLIENT_ID", "MONDAY_CLIENT_SECRET"], accountInput: "monday account / workspace", capabilities: ["GraphQL", "Webhooks", "Board mapping"] },
  { id: "close", name: "Close CRM", initials: "CL", description: "Leads, contacts, opportunities and communication activities.", priority: "Next", auth: "OAuth 2.0", credentials: ["CLOSE_CLIENT_ID", "CLOSE_CLIENT_SECRET"], accountInput: "Close organization", capabilities: ["Webhooks", "Event log", "REST API"] },
  { id: "bitrix24", name: "Bitrix24", initials: "B24", description: "Leads, contacts, companies, deals and tasks.", priority: "Next", auth: "OAuth 2.0 · cloud domain", credentials: ["BITRIX24_CLIENT_ID", "BITRIX24_CLIENT_SECRET"], accountInput: "Bitrix24 portal domain", capabilities: ["REST API", "Events", "Cloud portals"] },
  { id: "activecampaign", name: "ActiveCampaign", initials: "AC", description: "Contacts, accounts, deals and marketing activities.", priority: "Next", auth: "Account API URL + API key", credentials: [], accountInput: "ActiveCampaign account URL", capabilities: ["Webhooks", "REST API", "Automations"] },
] as const;

export type CrmProviderId = (typeof crmProviders)[number]["id"];

export const crmProviderIds = new Set<string>(crmProviders.map((provider) => provider.id));

export function crmProvider(id: string) {
  return crmProviders.find((provider) => provider.id === id);
}

export const crmSyncObjects = ["contacts", "companies", "deals", "activities", "tasks", "notes"] as const;

export const leadelyMappingFields: Record<(typeof crmSyncObjects)[number], string[]> = {
  contacts: ["display_name", "first_name", "last_name", "email", "phone", "job_title", "linkedin_url", "company_id"],
  companies: ["name", "domain", "website", "phone", "industry", "employee_count", "address", "country"],
  deals: ["name", "stage", "value", "currency", "company_id", "contact_id", "owner_user_id", "expected_close_date"],
  activities: ["type", "subject", "body", "occurred_at", "contact_id", "company_id", "deal_id"],
  tasks: ["title", "description", "status", "priority", "due_at", "owner_user_id", "deal_id"],
  notes: ["body", "contact_id", "company_id", "deal_id", "created_at"],
};
