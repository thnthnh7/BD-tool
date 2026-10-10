import type { SequenceStepInput } from "@/features/comms/sequence-validation";

export type SequenceTemplate = {
  id: string;
  name: string;
  description: string;
  steps: SequenceStepInput[];
};

export const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  {
    id: "prospect-introduction",
    name: "Prospect introduction",
    description: "A concise two-email introduction with a manual review before the final follow-up.",
    steps: [
      { stepType: "email", delayDays: 0, delayMinutes: 0, subject: "A quick question for {{company_name}}", body: "Hi {{first_name}},\n\nI noticed {{company_name}} and wanted to ask whether improving your current sales workflow is a priority this quarter.\n\nWould a short conversation be useful?" },
      { stepType: "wait", delayDays: 3, delayMinutes: 0, subject: "", body: "" },
      { stepType: "task", delayDays: 0, delayMinutes: 0, subject: "Review account before follow-up", body: "Check recent activity and personalize the final message." },
      { stepType: "email", delayDays: 1, delayMinutes: 0, subject: "Re: A quick question for {{company_name}}", body: "Hi {{first_name}},\n\nFollowing up in case this is relevant. If someone else owns this area, could you point me in the right direction?" },
    ],
  },
  {
    id: "inbound-follow-up",
    name: "Inbound lead follow-up",
    description: "Respond quickly, create a qualification task and check back once if the lead is quiet.",
    steps: [
      { stepType: "email", delayDays: 0, delayMinutes: 5, subject: "Thanks for your interest, {{first_name}}", body: "Hi {{first_name}},\n\nThanks for reaching out. I would like to understand what {{company_name}} is trying to achieve and see whether we can help. What would be a good time to talk?" },
      { stepType: "task", delayDays: 0, delayMinutes: 0, subject: "Qualify inbound lead", body: "Review the account, need, timing and decision process." },
      { stepType: "email", delayDays: 2, delayMinutes: 0, subject: "Re: Thanks for your interest", body: "Hi {{first_name}},\n\nJust checking whether you would still like to explore this. I am happy to work around your schedule." },
    ],
  },
  {
    id: "re-engagement",
    name: "Re-engage a quiet account",
    description: "A low-pressure check-in followed by a final close-the-loop note.",
    steps: [
      { stepType: "email", delayDays: 0, delayMinutes: 0, subject: "Still a priority for {{company_name}}?", body: "Hi {{first_name}},\n\nWe spoke previously and I wanted to check whether this is still a priority for {{company_name}}. If the timing changed, I am happy to reconnect later." },
      { stepType: "wait", delayDays: 5, delayMinutes: 0, subject: "", body: "" },
      { stepType: "email", delayDays: 0, delayMinutes: 0, subject: "Closing the loop", body: "Hi {{first_name}},\n\nI will close the loop for now. If this becomes relevant again, reply here and I will pick it back up." },
    ],
  },
];

export function getSequenceTemplate(id: string) {
  return SEQUENCE_TEMPLATES.find((template) => template.id === id) || null;
}
