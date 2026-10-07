"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, Badge, Button, Chip, FileButton, Group, Paper, Progress, SimpleGrid, Stack, Tabs, Text, Textarea, TextInput } from "@mantine/core";
import { Check, FileText, PackageSearch, Trash2, Upload, X } from "lucide-react";
import { EmptyState } from "@/components/leadely/empty-state";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { formatVnd } from "@/lib/money";
import { createModuleAction } from "@/lib/db/actions";
import type { ServiceModule } from "@/lib/types";
import type { Database } from "@/lib/database.types";
import { deleteKnowledgeDocumentAction, reviewModuleDraftAction } from "@/features/knowledge/server/actions";

type KnowledgeDocument = Database["public"]["Tables"]["knowledge_documents"]["Row"];
type ModuleDraft = Database["public"]["Tables"]["knowledge_module_drafts"]["Row"];

export function ModulesPanel({
  initialModules,
  initialDocuments,
  initialDrafts,
  canEdit,
}: {
  initialModules: ServiceModule[];
  initialDocuments: KnowledgeDocument[];
  initialDrafts: ModuleDraft[];
  canEdit: boolean;
}) {
  const t = useTranslations("Modules");
  const [modules, setModules] = useState(initialModules);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const resetFileRef = useRef<() => void>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const categories = ["All", ...Array.from(new Set(modules.map((module) => module.category)))];

  async function addModule() {
    if (!name.trim() || !canEdit) return;
    const result = await createModuleAction({ name, description, suggestedPrice: price });
    if (result.error) return;
    setModules([{ id: crypto.randomUUID(), name, description, suggestedPrice: price, category: "Product", defaultQty: 1, visualHint: "Custom module" }, ...modules]);
    setName("");
    setPrice(0);
    setDescription("");
  }

  const visible = useMemo(() => {
    return modules.filter((module) => {
      const matchesCategory = category === "All" || module.category === category;
      const matchesQuery = !query.trim() || `${module.name} ${module.description}`.toLowerCase().includes(query.trim().toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [modules, category, query]);

  async function uploadKnowledge(file: File | null) {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError("");
    setUploadProgress(18);
    const form = new FormData();
    form.set("file", file);
    try {
      const progressTimer = window.setInterval(() => setUploadProgress((value) => Math.min(90, value + 8)), 700);
      const response = await fetch("/api/knowledge/upload", { method: "POST", body: form });
      window.clearInterval(progressTimer);
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || t("processError"));
      setUploadProgress(100);
      resetFileRef.current?.();
      router.refresh();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("uploadError"));
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  }

  function reviewDraft(id: string, decision: "approve" | "reject") {
    startTransition(async () => {
      await reviewModuleDraftAction(id, decision);
      router.refresh();
    });
  }

  function deleteDocument(id: string) {
    startTransition(async () => {
      await deleteKnowledgeDocumentAction(id);
      router.refresh();
    });
  }

  return (
    <Stack gap="md">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Tabs defaultValue="catalog" keepMounted={false} data-tutorial-id="modules-tabs">
        <Tabs.List>
          <Tabs.Tab value="catalog" data-tutorial-id="modules-tab-catalog">{t("catalog")} ({modules.length})</Tabs.Tab>
          <Tabs.Tab value="knowledge" data-tutorial-id="modules-tab-knowledge">{t("knowledgeFiles")} ({initialDocuments.length})</Tabs.Tab>
          <Tabs.Tab value="review" data-tutorial-id="modules-tab-review">{t("needsReview")} ({initialDrafts.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="catalog" pt="md" data-tutorial-id="modules-catalog">
          <Stack gap="md">
      {canEdit ? (
        <SectionPanel title={t("addModule")}>
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput label={t("moduleName")} placeholder={t("moduleName")} value={name} onChange={(event) => setName(event.currentTarget.value)} />
              <TextInput label={t("suggestedPrice")} type="number" value={price} onChange={(event) => setPrice(Number(event.currentTarget.value))} />
            </SimpleGrid>
            <Textarea label={t("description")} placeholder={t("description")} minRows={3} value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
            <Button onClick={addModule} w="fit-content">
              {t("addModule")}
            </Button>
          </Stack>
        </SectionPanel>
      ) : null}

      <SectionPanel>
        <Group gap="sm" align="center">
          <TextInput placeholder={t("searchCatalog")} value={query} onChange={(event) => setQuery(event.currentTarget.value)} w={260} />
          <Chip.Group multiple={false} value={category} onChange={setCategory}>
            <Group gap="xs">
              {categories.map((item) => (
                <Chip key={item} value={item} size="sm" variant="outline">
                  {item}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Group>
      </SectionPanel>

      {visible.length === 0 ? (
        <SectionPanel>
          <EmptyState
            icon={<PackageSearch size={18} />}
            title={t("noModules")}
            description={t("noModulesHelp")}
          />
        </SectionPanel>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
          {visible.map((module) => (
            <SectionPanel key={module.id}>
              <Text size="xs" c="dimmed" fw={600}>
                {module.category}
              </Text>
              <Text fw={700} mt={4} lineClamp={2}>
                {module.name}
              </Text>
              <Text size="sm" c="dimmed" mt={4} lineClamp={3}>
                {module.description}
              </Text>
              <Text fw={700} mt="auto" pt="md" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatVnd(module.suggestedPrice)}
              </Text>
            </SectionPanel>
          ))}
        </SimpleGrid>
      )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="knowledge" pt="md" data-tutorial-id="modules-knowledge">
          <Stack gap="md">
            <SectionPanel title={t("addKnowledge")}>
              <Text size="sm" c="dimmed">
                {t("uploadHelp")}
              </Text>
              {canEdit ? (
                <Group mt="md">
                  <FileButton resetRef={resetFileRef} onChange={uploadKnowledge} accept=".pdf,.docx,.xlsx,.csv,.txt">
                    {(props) => <Button {...props} leftSection={<Upload size={16} />} loading={uploading}>{t("uploadIndex")}</Button>}
                  </FileButton>
                  <Text size="xs" c="dimmed">{t("workspaceIsolation")}</Text>
                </Group>
              ) : null}
              {uploading || uploadProgress > 0 ? <Progress mt="md" value={uploadProgress} animated={uploading} /> : null}
              {uploadError ? <Alert mt="md" color="red">{uploadError}</Alert> : null}
            </SectionPanel>
            {initialDocuments.length === 0 ? (
              <SectionPanel><EmptyState icon={<FileText size={18} />} title={t("noDocuments")} description={t("noDocumentsHelp")} /></SectionPanel>
            ) : (
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {initialDocuments.map((document) => (
                  <Paper key={document.id} withBorder radius="lg" p="md">
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <Group wrap="nowrap" align="flex-start">
                        <FileText size={20} />
                        <Stack gap={3}>
                          <Text fw={700} size="sm" lineClamp={2}>{document.file_name}</Text>
                          <Text size="xs" c="dimmed">{formatBytes(document.byte_size)} · {t("chunkCount", { count: document.chunk_count })}</Text>
                        </Stack>
                      </Group>
                      <Badge color={statusColor(document.status)} variant="light">{t(`status.${document.status}`)}</Badge>
                    </Group>
                    {document.error_message ? <Text size="xs" c="red" mt="sm">{document.error_message}</Text> : null}
                    <Group justify="space-between" mt="md">
                      <Text size="xs" c="dimmed">{t("characterCount", { count: document.extracted_chars.toLocaleString() })}</Text>
                      {canEdit ? <Button variant="subtle" color="red" size="compact-sm" loading={pending} onClick={() => deleteDocument(document.id)} leftSection={<Trash2 size={14} />}>{t("delete")}</Button> : null}
                    </Group>
                  </Paper>
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="review" pt="md" data-tutorial-id="modules-review">
          {initialDrafts.length === 0 ? (
            <SectionPanel><EmptyState icon={<Check size={18} />} title={t("noDrafts")} description={t("noDraftsHelp")} /></SectionPanel>
          ) : (
            <Stack gap="sm">
              {initialDrafts.map((draft) => (
                <Paper key={draft.id} withBorder radius="lg" p="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4} maw={760}>
                      <Text fw={700}>{draft.name}</Text>
                      <Text size="sm" c="dimmed">{draft.source_excerpt}</Text>
                    </Stack>
                    <Text fw={800} c="leadely">{formatVnd(draft.suggested_price)}</Text>
                  </Group>
                  {canEdit ? (
                    <Group mt="md" gap="xs">
                      <Button size="xs" loading={pending} leftSection={<Check size={14} />} onClick={() => reviewDraft(draft.id, "approve")}>{t("approve")}</Button>
                      <Button size="xs" variant="subtle" color="gray" loading={pending} leftSection={<X size={14} />} onClick={() => reviewDraft(draft.id, "reject")}>{t("skip")}</Button>
                    </Group>
                  ) : null}
                </Paper>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusColor(status: KnowledgeDocument["status"]) {
  return status === "ready" ? "teal" : status === "error" ? "red" : status === "archived" ? "gray" : "blue";
}
