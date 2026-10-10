export const SEQUENCE_STEP_TYPES = ["email", "task", "wait"] as const;
export type SequenceStepType = (typeof SEQUENCE_STEP_TYPES)[number];

export type SequenceStepInput = {
  stepType: string;
  delayDays: number;
  delayMinutes: number;
  subject: string;
  body: string;
};

export function validateSequenceStep(input: SequenceStepInput) {
  if (!SEQUENCE_STEP_TYPES.includes(input.stepType as SequenceStepType)) return { error: "Unsupported sequence step type." } as const;
  if (!Number.isInteger(input.delayDays) || input.delayDays < 0 || input.delayDays > 365) return { error: "Delay days must be between 0 and 365." } as const;
  if (!Number.isInteger(input.delayMinutes) || input.delayMinutes < 0 || input.delayMinutes > 1439) return { error: "Additional minutes must be between 0 and 1439." } as const;
  if (input.stepType === "email" && (!input.subject.trim() || !input.body.trim())) return { error: "Email steps require a subject and body." } as const;
  if (input.stepType === "task" && !input.subject.trim()) return { error: "Task steps require a title." } as const;
  return {
    value: {
      step_type: input.stepType as SequenceStepType,
      delay_days: input.delayDays,
      delay_minutes: input.delayMinutes,
      subject: input.subject.trim(),
      body: input.body.trim(),
    },
  } as const;
}
