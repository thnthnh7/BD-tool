"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ActionIcon, Button, FileButton, Group, List, ScrollArea, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { Archive, Maximize2, Minimize2, Paperclip, Plus, Sparkles, Square, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatAssistantReply } from "@/features/agent/logic";
import { AGENT_OPENED_EVENT, AGENT_PROMPT_EVENT, AGENT_TUTORIAL_OPEN_EVENT, TUTORIAL_OPENED_EVENT, openTutorial } from "@/features/tutorial/events";
import classes from "@/styles/agent-widget.module.css";

const conversationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Message = { id: string; role: string; content: string; blocks?: unknown };
type Approval = { approvalId: string; error?: string; preview: { tool?: string; lines?: string[]; fields?: unknown; cost?: string | null } };
type JobPreview = { jobId: string; headers: string[]; mapping: Record<string, string>; rowCount: number };

export function AgentWidget({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const t = useTranslations("Agent");
  const pathname = usePathname();
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const storageKey = `bizcraw-agent:${workspaceId}:${userId}`;
  const [open, setOpen] = useState(false);
  const [tutorialMode, setTutorialMode] = useState(false);
  const [full, setFull] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [unread, setUnread] = useState(false);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);
  const [job, setJob] = useState<JobPreview | null>(null);
  const [history, setHistory] = useState<{ id: string; title: string; unread: boolean }[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    let restore: number | null = null;
    if (saved && conversationIdPattern.test(saved)) restore = window.setTimeout(() => setConversationId(saved), 0);
    else if (saved) window.localStorage.removeItem(storageKey);
    return () => { if (restore !== null) window.clearTimeout(restore); };
  }, [storageKey]);

  useEffect(() => {
    if (!open || !conversationId) return;
    void fetch(`/api/agent/conversations/${conversationId}`).then((response) => response.json()).then((payload: { items?: Message[] }) => {
      setMessages(payload.items || []);
    });
  }, [open, conversationId]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const onTutorialOpen = () => {
      setOpen(false);
      setTutorialMode(false);
    };
    const onAgentTutorialOpen = () => {
      setOpen(true);
      setUnread(false);
      setTutorialMode(true);
    };
    const onAgentPrompt = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      setOpen(true);
      setUnread(false);
      setTutorialMode(false);
      if (prompt) setDraft(prompt);
      window.dispatchEvent(new Event(AGENT_OPENED_EVENT));
    };
    window.addEventListener(TUTORIAL_OPENED_EVENT, onTutorialOpen);
    window.addEventListener(AGENT_TUTORIAL_OPEN_EVENT, onAgentTutorialOpen);
    window.addEventListener(AGENT_PROMPT_EVENT, onAgentPrompt);
    return () => {
      window.removeEventListener(TUTORIAL_OPENED_EVENT, onTutorialOpen);
      window.removeEventListener(AGENT_TUTORIAL_OPEN_EVENT, onAgentTutorialOpen);
      window.removeEventListener(AGENT_PROMPT_EVENT, onAgentPrompt);
    };
  }, []);

  function openAgent() {
    const next = !open;
    setOpen(next);
    setTutorialMode(false);
    setUnread(false);
    if (next) window.dispatchEvent(new Event(AGENT_OPENED_EVENT));
  }

  async function ensureConversation() {
    if (conversationId && conversationIdPattern.test(conversationId)) return conversationId;
    const response = await fetch("/api/agent/conversations", { method: "POST" });
    const created = await response.json().catch(() => ({})) as { id?: string; error?: string };
    if (!response.ok || !created.id || !conversationIdPattern.test(created.id)) {
      throw new Error(created.error || t("error"));
    }
    setConversationId(created.id);
    window.localStorage.setItem(storageKey, created.id);
    return created.id;
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setStatus(t("thinking"));
    setDraft("");
    let id: string;
    try {
      id = await ensureConversation();
    } catch (error) {
      const detail = error instanceof Error ? error.message : t("error");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content }, { id: crypto.randomUUID(), role: "assistant", content: detail }]);
      setBusy(false);
      setStatus("");
      return;
    }
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content }]);
    const controller = new AbortController();
    abortRef.current = controller;
    let assistant = "";
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, message: content, pathname, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({ error: t("error") }));
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: payload.error || t("error") }]);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const assistantId = crypto.randomUUID();
      setMessages((current) => [...current, { id: assistantId, role: "assistant", content: "" }]);
      while (true) {
        const step = await reader.read();
        if (step.done) break;
        buffer += decoder.decode(step.value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));
          const eventLine = chunk.split("\n").find((line) => line.startsWith("event:"));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(5)) as { text?: string; message?: string; name?: string; result?: Approval; approvalId?: string };
          const event = eventLine?.slice(6).trim();
          if (event === "thinking" || event === "tool_start") setStatus(data.name ? t("tool", { name: data.name }) : t("thinking"));
          if (event === "token" && data.text) {
            assistant += data.text;
            setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: assistant } : item));
          }
          if (event === "tool_result" && data.result && "approvalId" in data.result) {
            const next = data.result as Approval;
            setApprovals((current) => current.some((item) => item.approvalId === next.approvalId) ? current : [...current, next]);
          }
          if (event === "error") setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: data.message || t("error") } : item));
        }
      }
    } catch {
      if (!controller.signal.aborted) setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: t("error") }]);
    } finally {
      setBusy(false);
      setStatus("");
      if (!open) setUnread(true);
    }
  }

  async function loadHistory() {
    const response = await fetch("/api/agent/conversations");
    const payload = await response.json() as { items?: { id: string; title: string; unread: boolean }[] };
    setHistory(payload.items || []);
    setHistoryOpen(true);
  }

  function attachFile(file: File | null) {
    if (!file) return;
    const body = new FormData();
    if (file.name.endsWith(".xlsx")) {
      void ensureConversation().then(async () => {
        body.set("file", file);
        const response = await fetch("/api/agent/imports", { method: "POST", body });
        if (response.ok) setJob(await response.json());
      }).catch(() => undefined);
    } else {
      void ensureConversation().then(async (id) => {
        body.set("file", file);
        body.set("conversationId", id);
        await fetch("/api/agent/attachments", { method: "POST", body });
      }).catch(() => undefined);
    }
  }

  async function decideGroup(decision: "approve" | "cancel") {
    if (pendingApproval || approvals.length === 0) return;
    const queue = approvals;
    setPendingApproval("group");
    try {
      if (decision === "cancel") {
        await Promise.all(queue.map((item) => fetch(`/api/agent/approvals/${item.approvalId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) })));
        setApprovals([]);
        return;
      }
      const remaining: Approval[] = [];
      const notices: string[] = [];
      let stopped = false;
      for (const item of queue) {
        if (stopped) {
          remaining.push(item);
          continue;
        }
        const response = await fetch(`/api/agent/approvals/${item.approvalId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
        const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
        if (!response.ok) {
          stopped = true;
          remaining.push({ ...item, error: payload.error || t("error") });
          continue;
        }
        if (payload.message) notices.push(payload.message);
      }
      setApprovals(remaining);
      if (notices.length > 0) setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: notices.join("\n") }]);
    } finally {
      setPendingApproval(null);
    }
  }

  return (
    <>
      {open ? (
        <section id={panelId} role="dialog" aria-modal="false" aria-label={t("title")} className={`${classes.panel} ${full ? classes.full : ""}`} data-tutorial-id="agent-panel">
          <Group justify="space-between" p="sm">
            <Text fw={700}>{t("title")}</Text>
            <Group gap={4}>
              <Tooltip label={t("history")}><ActionIcon variant="subtle" aria-label={t("history")} onClick={() => void loadHistory()}><Archive size={16} /></ActionIcon></Tooltip>
              <Tooltip label={t("newChat")}><ActionIcon variant="subtle" aria-label={t("newChat")} onClick={() => { setConversationId(null); setMessages([]); setApprovals([]); window.localStorage.removeItem(storageKey); }}><Plus size={16} /></ActionIcon></Tooltip>
              <Tooltip label={full ? t("collapse") : t("fullscreen")}><ActionIcon variant="subtle" aria-label={full ? t("collapse") : t("fullscreen")} onClick={() => setFull((value) => !value)}>{full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</ActionIcon></Tooltip>
              <Tooltip label={t("close")}><ActionIcon variant="subtle" aria-label={t("close")} onClick={() => setOpen(false)}><X size={16} /></ActionIcon></Tooltip>
            </Group>
          </Group>
          {historyOpen ? (
            <Stack gap={4} px="sm">
              {history.map((item) => (
                <Group key={item.id} gap={4}>
                  <Button variant="subtle" style={{ flex: 1 }} justify="space-between" onClick={() => { setConversationId(item.id); window.localStorage.setItem(storageKey, item.id); setHistoryOpen(false); }}>
                    {item.title || t("newChat")}{item.unread ? ` · ${t("unread")}` : ""}
                  </Button>
                  <Button size="compact-xs" variant="default" aria-label={t("rename")} onClick={() => {
                    const title = window.prompt(t("rename"), item.title);
                    if (title == null) return;
                    void fetch(`/api/agent/conversations/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }).then(() => void loadHistory());
                  }}>{t("rename")}</Button>
                  <Button size="compact-xs" variant="default" aria-label={t("archive")} onClick={() => {
                    void fetch(`/api/agent/conversations/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) }).then(() => void loadHistory());
                  }}>{t("archive")}</Button>
                </Group>
              ))}
            </Stack>
          ) : null}
          <ScrollArea className={classes.log}>
            {messages.length === 0 || tutorialMode ? (
              <Stack gap="sm" className={classes.emptyState} data-tutorial-id="agent-starters">
                <div>
                  <Text fw={700} size="sm">How can I help you get started?</Text>
                  <Text c="dimmed" size="xs" mt={3}>Choose a guided tour or ask about the page you are viewing.</Text>
                </div>
                <button type="button" className={classes.starter} onClick={() => openTutorial({ chapterId: "first-scrape" })}>Guide me through my first scrape</button>
                <button type="button" className={classes.starter} onClick={() => openTutorial({ chapterId: "apify" })}>Help me connect Apify</button>
                <button type="button" className={classes.starter} onClick={() => openTutorial({ chapterId: "mcp" })}>Connect an AI client with MCP</button>
                <button type="button" className={classes.starter} onClick={() => openTutorial({ chapterId: "workspace" })}>Show me how Bizcraw works</button>
                <button type="button" className={classes.starter} onClick={() => void send(`Explain what I can do on ${pathname}. Give me the best next action and guide me step by step.`)}>What can I do on this page?</button>
              </Stack>
            ) : null}
            <Stack gap="xs">
              {messages.map((message) => (
                message.role === "user" ? (
                  <Text key={message.id} size="sm"><strong>{t("you")}: </strong>{message.content}</Text>
                ) : (
                  <List key={message.id} size="sm" spacing={4} className={classes.reply}>
                    {formatAssistantReply(message.content).map((line, index) => (
                      <List.Item key={`${message.id}-${index}`}>{line}</List.Item>
                    ))}
                  </List>
                )
              ))}
              {approvals.length > 0 ? (
                <Stack gap={4}>
                  <Text size="sm" fw={600}>{approvals.length > 1 ? t("confirmPlan", { count: approvals.length }) : t("confirmTitle")}</Text>
                  <List size="sm" spacing={4} className={classes.reply}>
                    {approvals.map((approval) => (
                      <List.Item key={approval.approvalId}>
                        {(approval.preview.lines || []).join(", ") || approval.preview.tool}
                        {approval.error ? <Text span c="red" size="sm"> {approval.error}</Text> : null}
                      </List.Item>
                    ))}
                  </List>
                  {approvals.find((approval) => approval.preview.cost)?.preview.cost ? <Text size="sm">{approvals.find((approval) => approval.preview.cost)?.preview.cost}</Text> : null}
                  <Group>
                    <Button size="xs" disabled={pendingApproval === "group"} onClick={() => void decideGroup("approve")}>{t("confirm")}</Button>
                    <Button size="xs" variant="default" disabled={pendingApproval === "group"} onClick={() => void decideGroup("cancel")}>{t("cancel")}</Button>
                  </Group>
                </Stack>
              ) : null}
              {status ? <Text size="sm" c="dimmed" role="status">{status}</Text> : null}
            </Stack>
          </ScrollArea>
          {job ? <Text size="xs" px="sm">{t("importReady", { count: job.rowCount })}</Text> : null}
          <form className={classes.composer} data-tutorial-id="agent-composer" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
            <FileButton accept=".txt,.csv,.xlsx" onChange={attachFile}>
              {(props) => (
                <ActionIcon {...props} variant="subtle" aria-label={t("attach")}>
                  <Paperclip size={16} />
                </ActionIcon>
              )}
            </FileButton>
            <TextInput ref={inputRef} className={classes.field} aria-label={t("placeholder")} placeholder={t("placeholder")} value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />
            {busy ? <ActionIcon aria-label={t("stop")} onClick={() => abortRef.current?.abort()}><Square size={16} /></ActionIcon> : <ActionIcon type="submit" aria-label={t("send")}><Sparkles size={16} /></ActionIcon>}
          </form>
          {job ? <Group px="sm" pb="sm"><Button size="xs" onClick={() => void fetch(`/api/agent/jobs/${job.jobId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", mapping: job.mapping, duplicatePolicy: "skip" }) }).then(() => fetch(`/api/agent/jobs/${job.jobId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "tick" }) }))}>{t("confirm")}</Button></Group> : null}
        </section>
      ) : null}
      <div className={classes.launcher}>
        <ActionIcon size={52} radius="xl" variant="filled" aria-label={t("open")} aria-expanded={open} aria-controls={panelId} onClick={openAgent}>
          <Sparkles size={20} />
          {unread ? <span className={classes.srOnly}>{t("unread")}</span> : null}
        </ActionIcon>
      </div>
    </>
  );
}
