import type { CompanySettings, Quote, QuoteItem, DeliverableItem, PaymentMilestone, Client, ServiceModule, ModuleCategory } from "@/lib/types";
import type { Database, Json } from "@/lib/database.types";

type SettingsRow = Database["public"]["Tables"]["workspace_settings"]["Row"];
type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ModuleRow = Database["public"]["Tables"]["modules"]["Row"];

function asStringArray(value: Json | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function settingsFromRow(row: SettingsRow): CompanySettings {
  return {
    companyName: row.company_name,
    shortName: row.short_name,
    taxCode: row.tax_code,
    address: row.address,
    email: row.email,
    phone: row.phone,
    website: row.website,
    logoPath: row.logo_path,
    accentColor: row.accent_color,
    currency: "VND",
    vatRate: Number(row.vat_rate),
    quoteValidityDays: row.quote_validity_days,
    about: row.about,
    terms: asStringArray(row.terms),
    legalRepresentative: row.legal_representative,
    legalRepresentativeTitle: row.legal_representative_title,
    bankAccountNumber: row.bank_account_number,
    bankAccountName: row.bank_account_name,
    bankName: row.bank_name,
    contractNumberPrefix: row.contract_number_prefix,
    defaultWarrantyMonths: row.default_warranty_months,
    defaultMaintenanceFee: row.default_maintenance_fee,
  };
}

export function settingsToUpdate(settings: CompanySettings) {
  return {
    company_name: settings.companyName,
    short_name: settings.shortName,
    tax_code: settings.taxCode,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    website: settings.website,
    logo_path: settings.logoPath,
    accent_color: settings.accentColor,
    vat_rate: settings.vatRate,
    quote_validity_days: settings.quoteValidityDays,
    about: settings.about,
    terms: settings.terms,
    legal_representative: settings.legalRepresentative,
    legal_representative_title: settings.legalRepresentativeTitle,
    bank_account_number: settings.bankAccountNumber,
    bank_account_name: settings.bankAccountName,
    bank_name: settings.bankName,
    contract_number_prefix: settings.contractNumberPrefix,
    default_warranty_months: settings.defaultWarrantyMonths,
    default_maintenance_fee: settings.defaultMaintenanceFee,
  };
}

export function clientFromRow(row: ClientRow): Client {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    taxCode: row.tax_code,
    address: row.address,
    representativeTitle: row.representative_title,
    authorizationDoc: row.authorization_doc,
    logoUrl: row.logo_url,
    industry: row.industry,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function moduleFromRow(row: ModuleRow): ServiceModule {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ModuleCategory,
    description: row.description,
    suggestedPrice: row.suggested_price,
    defaultQty: row.default_qty,
    visualHint: row.visual_hint,
  };
}

function asItems(value: Json): QuoteItem[] {
  if (!Array.isArray(value)) return [];
  return value as QuoteItem[];
}

function asDeliverables(value: Json): DeliverableItem[] {
  if (!Array.isArray(value)) return [];
  return value as DeliverableItem[];
}

function asMilestones(value: Json): PaymentMilestone[] {
  if (!Array.isArray(value)) return [];
  return value as PaymentMilestone[];
}

export function quoteFromRow(row: QuoteRow): Quote {
  return {
    id: row.id,
    publicId: row.public_id,
    clientId: row.client_id || "",
    title: row.title,
    projectType: row.project_type as Quote["projectType"],
    status: row.status as Quote["status"],
    currency: "VND",
    items: asItems(row.items),
    deliverables: asDeliverables(row.deliverables),
    discount: Number(row.discount),
    vatRate: Number(row.vat_rate),
    validUntil: row.valid_until || "",
    projectOverview: row.project_overview,
    timeline: row.timeline,
    nextSteps: row.next_steps,
    contractNumber: row.contract_number,
    paymentMilestones: asMilestones(row.payment_milestones),
    techStack: asStringArray(row.tech_stack),
    warrantyMonths: row.warranty_months,
    maintenanceFeeMonthly: row.maintenance_fee_monthly,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dealId: row.deal_id || undefined,
    revisionNumber: row.revision_number,
    quoteStatusV2: row.quote_status_v2 || undefined,
    deckStyle: row.deck_style || "signal",
    presentationSource: row.presentation_source === "upload" ? "upload" : "generated",
    proposalPdfPath: row.proposal_pdf_path || undefined,
    proposalPdfName: row.proposal_pdf_name || undefined,
    contractDocxPath: row.contract_docx_path || undefined,
    contractDocxName: row.contract_docx_name || undefined,
    contractStatus: (row.contract_status as Quote["contractStatus"]) || "draft",
  };
}

export function quoteToRow(quote: Quote, workspaceId: string) {
  return {
    id: quote.id,
    workspace_id: workspaceId,
    public_id: quote.publicId,
    client_id: quote.clientId || null,
    title: quote.title,
    project_type: quote.projectType,
    status: quote.status,
    items: quote.items as unknown as Json,
    deliverables: quote.deliverables as unknown as Json,
    discount: quote.discount,
    vat_rate: quote.vatRate,
    valid_until: quote.validUntil || null,
    project_overview: quote.projectOverview,
    timeline: quote.timeline,
    next_steps: quote.nextSteps,
    contract_number: quote.contractNumber,
    payment_milestones: quote.paymentMilestones as unknown as Json,
    tech_stack: quote.techStack,
    warranty_months: quote.warrantyMonths,
    maintenance_fee_monthly: quote.maintenanceFeeMonthly,
    deal_id: quote.dealId || null,
    revision_number: quote.revisionNumber || 1,
    quote_status_v2: quote.quoteStatusV2 || null,
    deck_style: quote.deckStyle || "signal",
    presentation_source: quote.presentationSource || "generated",
    proposal_pdf_path: quote.proposalPdfPath || null,
    proposal_pdf_name: quote.proposalPdfName || null,
    contract_docx_path: quote.contractDocxPath || null,
    contract_docx_name: quote.contractDocxName || null,
    contract_status: quote.contractStatus || "draft",
    sent_at: null as string | null,
    accepted_at: null as string | null,
    rejected_at: null as string | null,
  };
}
