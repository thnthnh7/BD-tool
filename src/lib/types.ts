export type QuoteStatus = "draft" | "sent" | "won" | "lost";

export type ProjectType =
  | "Web App"
  | "Mobile App"
  | "MVP"
  | "Internal Tool"
  | "Maintenance"
  | "Custom Software";

export type DeliverablePriority = "Cao" | "Trung" | "Thấp";

export type Client = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  taxCode?: string;
  address?: string;
  representativeTitle?: string;
  authorizationDoc?: string;
  /** Logo URL or compressed data URI for slideshow branding */
  logoUrl?: string;
  industry?: string;
  notes?: string;
  createdAt: string;
};

export type CompanySettings = {
  companyName: string;
  shortName: string;
  taxCode: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  logoPath: string;
  accentColor: string;
  currency: "VND";
  vatRate: number;
  quoteValidityDays: number;
  about: string;
  terms: string[];
  legalRepresentative: string;
  legalRepresentativeTitle: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankName: string;
  contractNumberPrefix: string;
  defaultWarrantyMonths: number;
  defaultMaintenanceFee: number;
};

export type ModuleCategory =
  | "Discovery"
  | "Product"
  | "User"
  | "Commerce"
  | "Admin"
  | "Integration"
  | "Quality"
  | "Support";

export type ServiceModule = {
  id: string;
  name: string;
  category: ModuleCategory;
  description: string;
  suggestedPrice: number;
  defaultQty: number;
  visualHint: string;
};

export type QuoteItem = {
  id: string;
  moduleId?: string;
  name: string;
  description: string;
  qty: number;
  unitPrice: number;
};

export type DeliverableItem = {
  id: string;
  name: string;
  description: string;
  moduleName?: string;
  referencePrice?: number;
  priority: DeliverablePriority;
  effortDays?: number;
  notes?: string;
};

export type PaymentMilestone = {
  id: string;
  label: string;
  description: string;
  percent: number;
  trigger: string;
};

export type Quote = {
  id: string;
  publicId: string;
  clientId: string;
  title: string;
  projectType: ProjectType;
  status: QuoteStatus;
  currency: "VND";
  items: QuoteItem[];
  deliverables: DeliverableItem[];
  discount: number;
  vatRate: number;
  validUntil: string;
  projectOverview: string;
  timeline: string;
  nextSteps: string;
  contractNumber: string;
  paymentMilestones: PaymentMilestone[];
  techStack: string[];
  warrantyMonths: number;
  maintenanceFeeMonthly: number;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  settings: CompanySettings;
  clients: Client[];
  modules: ServiceModule[];
  quotes: Quote[];
};

export type QuoteTotals = {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  vatAmount: number;
  grandTotal: number;
};
