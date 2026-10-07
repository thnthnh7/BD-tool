export const TUTORIAL_OPEN_EVENT = "bizcraw:tutorial-open";
export const TUTORIAL_OPENED_EVENT = "bizcraw:tutorial-opened";
export const AGENT_OPENED_EVENT = "bizcraw:agent-opened";
export const AGENT_PROMPT_EVENT = "bizcraw:agent-prompt";
export const AGENT_TUTORIAL_OPEN_EVENT = "bizcraw:agent-tutorial-open";

export type TutorialOpenDetail = { chapterId?: string; stepId?: string };

export function openTutorial(detail: TutorialOpenDetail = {}) {
  window.dispatchEvent(new CustomEvent<TutorialOpenDetail>(TUTORIAL_OPEN_EVENT, { detail }));
}

export function askAgent(prompt: string) {
  window.dispatchEvent(new CustomEvent<{ prompt: string }>(AGENT_PROMPT_EVENT, { detail: { prompt } }));
}

export function openAgentForTutorial() {
  window.dispatchEvent(new Event(AGENT_TUTORIAL_OPEN_EVENT));
}
