"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ActionIcon, Badge, Button, Group, Progress, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, ChevronRight, ExternalLink, Sparkles, X } from "lucide-react";
import { findTutorialChapter, tutorialChapters, type TutorialChapter, type TutorialStep } from "@/features/tutorial/content";
import {
  AGENT_OPENED_EVENT,
  TUTORIAL_OPEN_EVENT,
  TUTORIAL_OPENED_EVENT,
  askAgent,
  openAgentForTutorial,
  type TutorialOpenDetail,
} from "@/features/tutorial/events";
import classes from "./tutorial-book.module.css";

type TutorialProgress = {
  seen: boolean;
  chapterId?: string;
  stepIndex: number;
  completed: string[];
};

type TargetRect = { top: number; left: number; width: number; height: number };

export function TutorialBook({
  workspaceId,
  userId,
  role,
  features,
  besideAgent,
}: {
  workspaceId: string;
  userId: string;
  role: string;
  features: Record<string, boolean | undefined>;
  besideAgent: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const storageKey = `bizcraw-tutorial:${workspaceId}:${userId}`;
  const [open, setOpen] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState("workspace");
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [coachStep, setCoachStep] = useState<TutorialStep | null>(null);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const pendingRef = useRef<{ chapterId: string; stepIndex: number } | null>(null);

  const chapters = useMemo(
    () => tutorialChapters
      .filter((chapter) => (!chapter.roles || chapter.roles.includes(role)) && (!chapter.feature || features[chapter.feature] === true))
      .sort((left, right) => left.number - right.number),
    [features, role],
  );
  const activeChapter = chapters.find((chapter) => chapter.id === activeChapterId) || chapters[0];
  const activeStep = activeChapter?.steps[stepIndex] || activeChapter?.steps[0];
  const totalSteps = chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0);
  const completion = totalSteps ? Math.round((completed.length / totalSteps) * 100) : 0;

  const saveProgress = useCallback((next: Partial<TutorialProgress> = {}) => {
    const progress: TutorialProgress = {
      seen: true,
      chapterId: activeChapter?.id,
      stepIndex,
      completed,
      ...next,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [activeChapter?.id, completed, stepIndex, storageKey]);

  const closeCoach = useCallback(() => {
    targetRef.current = null;
    pendingRef.current = null;
    setCoachStep(null);
    setTargetRect(null);
    setTargetMissing(false);
  }, []);

  const openBook = useCallback((detail: TutorialOpenDetail = {}) => {
    const requested = findTutorialChapter(detail.chapterId);
    const chapter = requested && chapters.some((item) => item.id === requested.id) ? requested : chapters[0];
    if (chapter) {
      const requestedIndex = detail.stepId ? chapter.steps.findIndex((step) => step.id === detail.stepId) : -1;
      setActiveChapterId(chapter.id);
      setStepIndex(requestedIndex >= 0 ? requestedIndex : 0);
    }
    closeCoach();
    setOpen(true);
    window.dispatchEvent(new Event(TUTORIAL_OPENED_EVENT));
  }, [chapters, closeCoach]);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    let restore: number | null = null;
    let welcome: number | null = null;
    if (raw) {
      try {
        const saved = JSON.parse(raw) as TutorialProgress;
        restore = window.setTimeout(() => {
          if (saved.chapterId && chapters.some((chapter) => chapter.id === saved.chapterId)) setActiveChapterId(saved.chapterId);
          setStepIndex(Number.isInteger(saved.stepIndex) ? saved.stepIndex : 0);
          setCompleted(Array.isArray(saved.completed) ? saved.completed : []);
        }, 0);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    } else {
      welcome = window.setTimeout(() => openBook({ chapterId: "workspace" }), 800);
    }
    const onTutorialOpen = (event: Event) => openBook((event as CustomEvent<TutorialOpenDetail>).detail || {});
    const onAgentOpen = () => {
      setOpen(false);
      closeCoach();
    };
    window.addEventListener(TUTORIAL_OPEN_EVENT, onTutorialOpen);
    window.addEventListener(AGENT_OPENED_EVENT, onAgentOpen);
    return () => {
      if (restore !== null) window.clearTimeout(restore);
      if (welcome !== null) window.clearTimeout(welcome);
      window.removeEventListener(TUTORIAL_OPEN_EVENT, onTutorialOpen);
      window.removeEventListener(AGENT_OPENED_EVENT, onAgentOpen);
    };
  }, [chapters, closeCoach, openBook, storageKey]);

  const locateTarget = useCallback((chapterId: string, index: number) => {
    const chapter = chapters.find((item) => item.id === chapterId);
    const step = chapter?.steps[index];
    if (!chapter || !step) return;
    setCoachStep(step);
    setTargetMissing(false);
    const targetIds = [step.target, ...(step.fallbackTargets || [])].filter((target): target is string => Boolean(target));
    if (targetIds.length === 0) {
      setOpen(true);
      setTargetRect(null);
      return;
    }
    const started = Date.now();
    let triggered = false;
    const find = () => {
      if (step.triggerTarget && !triggered) {
        const trigger = document.querySelector<HTMLElement>(`[data-tutorial-id="${step.triggerTarget}"]`);
        if (trigger) {
          triggered = true;
          const interactive = trigger.matches("a, button, [role='button']")
            ? trigger
            : trigger.querySelector<HTMLElement>("a, button, [role='button']");
          (interactive || trigger).click();
          window.setTimeout(find, 100);
          return;
        }
      }
      const target = targetIds.map((id) => document.querySelector<HTMLElement>(`[data-tutorial-id="${id}"]`)).find(Boolean);
      if (!target) {
        if (Date.now() - started < 6000) window.setTimeout(find, 120);
        else {
          setTargetMissing(true);
          setOpen(true);
          setTargetRect(null);
        }
        return;
      }
      targetRef.current = target;
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      }, 420);
    };
    find();
  }, [chapters]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const timer = window.setTimeout(() => locateTarget(pending.chapterId, pending.stepIndex), 80);
    return () => window.clearTimeout(timer);
  }, [locateTarget, pathname]);

  useEffect(() => {
    if (!targetRef.current || !coachStep) return;
    const update = () => {
      const rect = targetRef.current?.getBoundingClientRect();
      if (rect) setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new MutationObserver(() => {
      if (!coachStep.target) return;
      const primary = document.querySelector<HTMLElement>(`[data-tutorial-id="${coachStep.target}"]`);
      if (!primary || primary === targetRef.current) return;
      targetRef.current = primary;
      primary.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      window.setTimeout(update, 420);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [coachStep]);

  function selectChapter(chapter: TutorialChapter) {
    setActiveChapterId(chapter.id);
    setStepIndex(0);
    saveProgress({ chapterId: chapter.id, stepIndex: 0 });
  }

  function startStep(chapter: TutorialChapter, index: number, progressCompleted = completed) {
    const step = chapter.steps[index];
    if (!step) return;
    setActiveChapterId(chapter.id);
    setStepIndex(index);
    saveProgress({ chapterId: chapter.id, stepIndex: index, completed: progressCompleted });
    if (step.externalUrl) {
      window.open(step.externalUrl, "_blank", "noopener,noreferrer");
      setCoachStep(step);
      return;
    }
    setOpen(false);
    pendingRef.current = { chapterId: chapter.id, stepIndex: index };
    if (step.openAgent) openAgentForTutorial();
    const currentLocation = `${pathname}${window.location.search}`;
    if (step.path && currentLocation !== step.path) router.push(step.path);
    else if (step.entryPath) {
      const targetIds = [step.target, ...(step.fallbackTargets || [])].filter((target): target is string => Boolean(target));
      const hasVisibleTarget = targetIds.some((id) => document.querySelector(`[data-tutorial-id="${id}"]`));
      if (!hasVisibleTarget && currentLocation !== step.entryPath) router.push(step.entryPath);
      else locateTarget(chapter.id, index);
    }
    else locateTarget(chapter.id, index);
  }

  function completeCurrent() {
    if (!activeChapter || !activeStep) return completed;
    const key = `${activeChapter.id}:${activeStep.id}`;
    const nextCompleted = completed.includes(key) ? completed : [...completed, key];
    setCompleted(nextCompleted);
    saveProgress({ completed: nextCompleted });
    return nextCompleted;
  }

  function moveStep(direction: -1 | 1) {
    if (!activeChapter) return;
    const progressCompleted = direction > 0 ? completeCurrent() : completed;
    const nextIndex = stepIndex + direction;
    if (nextIndex >= 0 && nextIndex < activeChapter.steps.length) {
      closeCoach();
      startStep(activeChapter, nextIndex, progressCompleted);
      return;
    }
    const chapterIndex = chapters.findIndex((chapter) => chapter.id === activeChapter.id);
    const nextChapter = chapters[chapterIndex + direction];
    if (nextChapter) {
      closeCoach();
      startStep(nextChapter, direction > 0 ? 0 : nextChapter.steps.length - 1, progressCompleted);
    } else {
      closeCoach();
      setOpen(true);
    }
  }

  function askCurrentStep() {
    const prompt = activeStep?.aiPrompt || `Guide me through “${activeStep?.title || activeChapter?.title}” on ${pathname}. Explain what I should do, what to enter, and what to check before continuing.`;
    setOpen(false);
    closeCoach();
    askAgent(prompt);
  }

  const coachStyle = targetRect && typeof window !== "undefined" ? {
    top: Math.min(window.innerHeight - 250, Math.max(16, targetRect.top + targetRect.height + 14)),
    left: Math.min(window.innerWidth - 354, Math.max(16, targetRect.left)),
  } : undefined;

  return (
    <>
      {open && activeChapter ? (
        <aside className={classes.panel} role="dialog" aria-label="Bizcraw tutorial book">
          <div className={classes.header}>
            <div>
              <Group gap={8}><BookOpenCheck size={18} /><Text fw={750}>Getting started</Text></Group>
              <Text size="xs" c="dimmed">Interactive guides for your workspace</Text>
            </div>
            <ActionIcon variant="subtle" aria-label="Close tutorial" onClick={() => { saveProgress(); setOpen(false); }}><X size={17} /></ActionIcon>
          </div>
          <div className={classes.progressBlock}>
            <Group justify="space-between"><Text size="xs" fw={650}>Your progress</Text><Text size="xs" c="dimmed">{completion}%</Text></Group>
            <Progress value={completion} size={6} mt={6} color="teal" />
          </div>
          <ScrollArea className={classes.body} type="hover">
            <Stack gap="xs">
              {chapters.map((chapter) => {
                const selected = chapter.id === activeChapter.id;
                const done = chapter.steps.every((step) => completed.includes(`${chapter.id}:${step.id}`));
                return (
                  <button key={chapter.id} type="button" className={`${classes.chapter} ${selected ? classes.chapterActive : ""}`} onClick={() => selectChapter(chapter)}>
                    <span className={classes.chapterNumber}>{done ? <Check size={14} /> : String(chapter.number).padStart(2, "0")}</span>
                    <span className={classes.chapterCopy}><strong>{chapter.title}</strong><small>{chapter.description}</small></span>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
            </Stack>
          </ScrollArea>
          <div className={classes.activeGuide}>
            <Group justify="space-between" align="flex-start" gap="xs">
              <div><Badge variant="light" color="teal" size="sm">Chapter {activeChapter.number}</Badge><Text fw={750} mt={6}>{activeChapter.title}</Text></div>
              <Text size="xs" c="dimmed">{activeChapter.duration}</Text>
            </Group>
            <ScrollArea className={classes.stepScroll} type="auto" offsetScrollbars>
              <Stack gap={6} pr={6}>
                {activeChapter.steps.map((step, index) => (
                  <button key={step.id} type="button" className={`${classes.step} ${index === stepIndex ? classes.stepActive : ""}`} onClick={() => startStep(activeChapter, index)}>
                    <span>{completed.includes(`${activeChapter.id}:${step.id}`) ? <Check size={13} /> : index + 1}</span>
                    <span>{step.title}</span>
                  </button>
                ))}
              </Stack>
            </ScrollArea>
            {activeStep ? <Text size="sm" c="dimmed" mt="sm" className={classes.stepDescription}>{activeStep.body}</Text> : null}
            <Button
              fullWidth
              mt="sm"
              rightSection={activeStep?.externalUrl ? <ExternalLink size={15} /> : <ArrowRight size={15} />}
              onClick={() => startStep(activeChapter, stepIndex)}
            >
              {activeStep?.externalUrl ? activeStep.actionLabel || "Open resource" : "Show me this step"}
            </Button>
          </div>
        </aside>
      ) : null}

      {coachStep && targetRect ? (
        <div className={classes.coachLayer} aria-live="polite">
          <div className={classes.spotlight} style={{ top: targetRect.top - 6, left: targetRect.left - 6, width: targetRect.width + 12, height: targetRect.height + 12 }} />
          <div className={classes.coachmark} style={coachStyle}>
            <Group justify="space-between" align="flex-start" gap="xs">
              <Badge variant="light" color="teal">Step {stepIndex + 1} of {activeChapter?.steps.length || 1}</Badge>
              <ActionIcon variant="subtle" size="sm" aria-label="Exit guided step" onClick={() => { closeCoach(); setOpen(true); }}><X size={15} /></ActionIcon>
            </Group>
            <Text fw={750} mt={8}>{coachStep.title}</Text>
            <Text size="sm" c="dimmed" mt={4}>{coachStep.body}</Text>
            <Group justify="space-between" mt="md" wrap="nowrap">
              <Button variant="subtle" size="xs" leftSection={<Sparkles size={14} />} onClick={askCurrentStep}>Ask AI</Button>
              <Group gap={6} wrap="nowrap">
                <ActionIcon variant="default" aria-label="Previous tutorial step" onClick={() => moveStep(-1)}><ArrowLeft size={15} /></ActionIcon>
                <Button size="xs" rightSection={<ArrowRight size={14} />} onClick={() => moveStep(1)}>Got it</Button>
              </Group>
            </Group>
          </div>
        </div>
      ) : null}

      {targetMissing && coachStep ? (
        <div className={classes.missingNotice} role="status">
          <Text fw={700} size="sm">This item is not visible yet</Text>
          <Text size="xs" c="dimmed">Your role, plan, or the current record may not include it. You can continue manually.</Text>
          <Group mt="xs"><Button size="xs" onClick={() => moveStep(1)}>Continue</Button><Button size="xs" variant="default" onClick={() => { closeCoach(); setOpen(true); }}>Back to book</Button></Group>
        </div>
      ) : null}

      <div className={`${classes.launcher} ${besideAgent ? classes.besideAgent : ""}`}>
        <Tooltip label="Open tutorial book" position="top">
          <ActionIcon size={52} radius="xl" variant="default" aria-label="Open tutorial book" aria-expanded={open} onClick={() => openBook({ chapterId: activeChapter?.id })}>
            <BookOpenCheck size={20} />
          </ActionIcon>
        </Tooltip>
      </div>
    </>
  );
}
