export type AiBriefModule = {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  pricingReason: string;
};

export type AiBriefDeliverable = {
  name: string;
  description: string;
  moduleName: string;
  priority: "Cao" | "Trung" | "Thấp";
  effortDays: number;
  referencePrice: number;
  acceptanceCriteria: string[];
};

export type AiBriefResult = {
  projectName: string;
  projectType: string;
  executiveSummary: string;
  businessGoals: string[];
  targetUsers: string[];
  assumptions: string[];
  outOfScope: string[];
  modules: AiBriefModule[];
  deliverables: AiBriefDeliverable[];
  timeline: string;
  recommendedTechStack: string[];
  risks: string[];
  clarifyingQuestions: string[];
};
