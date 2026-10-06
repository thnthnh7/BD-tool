import { Alert, Anchor, Badge, Box, Checkbox, Group, MultiSelect, NativeSelect, SimpleGrid, Stack, TagsInput, Text, Textarea, TextInput } from "@mantine/core";
import { Info, TriangleAlert } from "lucide-react";
import { ActionForm } from "@/features/crm/components/action-form";
import { actorInputGuide, readableActorFields, unsupportedActorFields, type ActorField } from "@/features/leads/actor-input";
import { startActorScrapeAction } from "@/features/leads/server/scrape-actions";
import type { Json } from "@/lib/database.types";
import { useTranslations } from "next-intl";
import { ActorGuideDrawer } from "@/features/leads/components/actor-guide-drawer";
import type { StructuredActorGuide } from "@/features/leads/actor-guide";

type FieldSection = { title: string; description: string; fields: ActorField[] };

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 — $2")
    .replace(/[*_`]+/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function shortText(value: string, max = 180) {
  const clean = plainText(value);
  if (clean.length <= max) return clean;
  const sentence = clean.slice(0, max + 1).match(/^(.{40,}?[.!?])(?:\s|$)/)?.[1];
  return sentence || `${clean.slice(0, max).trimEnd()}…`;
}

function actorSections(fields: ActorField[]) {
  const sections: FieldSection[] = [{ title: "", description: "", fields: [] }];
  for (const field of fields) {
    if (field.sectionCaption && sections.at(-1)?.title !== field.sectionCaption) {
      sections.push({ title: field.sectionCaption, description: field.sectionDescription, fields: [] });
    }
    sections.at(-1)?.fields.push(field);
  }
  return sections.filter((section) => section.fields.length);
}

function fieldHelp(field: ActorField, listHint: string) {
  const notes = [shortText(field.description, 150)];
  if ((field.kind === "stringList" || field.kind === "urlList") && !notes[0]) notes.push(listHint);
  if (field.unit) notes.push(`Unit: ${field.unit}`);
  if (field.editor === "schemaBased") notes.push("Enter a JSON value.");
  if (field.minimum != null && field.maximum != null) notes.push(`Allowed range: ${field.minimum}–${field.maximum}`);
  else if (field.minimum != null) notes.push(`Minimum: ${field.minimum}`);
  else if (field.maximum != null) notes.push(`Maximum: ${field.maximum}`);
  return notes.filter(Boolean).join(" · ");
}

function FieldControl({ field, highlighted = false }: { field: ActorField; highlighted?: boolean }) {
  const t = useTranslations("Scrape");
  const name = `in_${field.name}`;
  const description = fieldHelp(field, t("onePerLine"));
  const label = <Group gap={6} wrap="wrap">
    <Text component="span" size="sm" fw={600}>{field.label}</Text>
    {field.required ? <Badge size="xs" color="red" variant="light">Required</Badge> : null}
    {field.advanced ? <Badge size="xs" color="violet" variant="light">Advanced</Badge> : null}
    {highlighted ? <Badge size="xs" color="blue">AI draft</Badge> : null}
  </Group>;
  if (field.kind === "boolean") return <Checkbox name={name} label={field.label} description={description || undefined} defaultChecked={field.defaultValue === "on"} />;
  if (field.kind === "enum") return <NativeSelect name={name} label={label} description={description || undefined} data={[{ value: "", label: t("choose") }, ...field.options]} defaultValue={field.defaultValue} required={field.required} />;
  if (field.kind === "multiEnum") return <MultiSelect
    name={name}
    label={label}
    description={description || undefined}
    data={field.options}
    defaultValue={field.defaultValue.split("\n").filter(Boolean)}
    hiddenInputValuesDivider="\n"
    searchable
    clearable
    required={field.required}
    maxValues={field.maxItems ?? undefined}
  />;
  if (field.kind === "stringTags") return <TagsInput
    name={name}
    label={label}
    description={description || undefined}
    data={field.suggestions}
    defaultValue={field.defaultValue.split("\n").filter(Boolean)}
    hiddenInputValuesDivider="\n"
    clearable
    required={field.required}
    maxTags={field.maxItems ?? undefined}
  />;
  if (field.kind === "text" || field.kind === "stringList" || field.kind === "urlList" || field.kind === "json") {
    return <Textarea name={name} label={label} description={description || undefined} defaultValue={field.defaultValue} required={field.required} minRows={field.kind === "json" ? 3 : 2} maxRows={field.kind === "json" ? 8 : 5} autosize />;
  }
  const suggestionsId = field.suggestions.length ? `actor-suggestions-${field.name.replace(/[^a-zA-Z0-9_-]/g, "-")}` : undefined;
  return <>
    <TextInput
    name={name}
    type={field.secret ? "password" : field.kind === "number" ? "number" : field.kind === "date" && field.dateType === "absolute" ? "date" : "text"}
    label={label}
    description={description || undefined}
    placeholder={field.exampleValue && !field.defaultValue ? field.exampleValue.slice(0, 180) : undefined}
    defaultValue={field.defaultValue}
    required={field.required}
    min={field.minimum ?? undefined}
    max={field.maximum ?? undefined}
    minLength={field.minLength ?? undefined}
    maxLength={field.maxLength ?? undefined}
    pattern={field.pattern || undefined}
    list={suggestionsId}
  />
    {suggestionsId ? <datalist id={suggestionsId}>{field.suggestions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist> : null}
  </>;
}

function FieldGrid({ fields, highlightedNames }: { fields: ActorField[]; highlightedNames: Set<string> }) {
  return <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
    {fields.map((field) => {
      const wide = field.kind === "text" || field.kind === "stringList" || field.kind === "urlList" || field.kind === "json";
      return <Box key={field.name} style={wide ? { gridColumn: "1 / -1" } : undefined}><FieldControl field={field} highlighted={highlightedNames.has(field.name)} /></Box>;
    })}
  </SimpleGrid>;
}

export function ActorInputForm({ sourceId, sourceSlug, schema, initialInput, exampleAvailable = false, readmeMarkdown = "", structuredGuide, buildNumber = null, contractHash = null, fetchedAt = null, stale = false, canManage = false, draftApplied = false, pricingModel = null }: {
  sourceId: string;
  sourceSlug: string;
  schema: Json;
  initialInput: Json | null;
  exampleAvailable?: boolean;
  readmeMarkdown?: string;
  structuredGuide?: StructuredActorGuide;
  buildNumber?: string | null;
  contractHash?: string | null;
  fetchedAt?: string | null;
  stale?: boolean;
  canManage?: boolean;
  draftApplied?: boolean;
  pricingModel?: string | null;
}) {
  const t = useTranslations("Scrape");
  const guide = actorInputGuide(schema);
  const fields = readableActorFields(schema, initialInput);
  const unsupported = unsupportedActorFields(schema);
  const requiredUnsupported = unsupported.filter((field) => field.required);
  const jsonFallbackSafe = requiredUnsupported.length > 0 && requiredUnsupported.every((field) => !["fileupload", "resourcePicker"].includes(field.editor) && !/secret/i.test(field.reason));
  const sections = actorSections(fields);
  const rootSection = sections.find((section) => !section.title);
  const requiredRootFields = rootSection?.fields.filter((field) => field.required) || [];
  const primaryRootFields = [
    ...requiredRootFields,
    ...(rootSection?.fields.filter((field) => !field.required && !field.advanced).slice(0, Math.max(0, 4 - requiredRootFields.length)) || []),
  ];
  const primaryNames = new Set(primaryRootFields.map((field) => field.name));
  const additionalRootFields = rootSection?.fields.filter((field) => !primaryNames.has(field.name)) || [];
  const titledSections = sections.filter((section) => section.title);
  const highlightedNames = new Set(draftApplied && initialInput && typeof initialInput === "object" && !Array.isArray(initialInput) ? Object.keys(initialInput) : []);
  const actorUrl = `https://apify.com/${sourceSlug.split("/").map(encodeURIComponent).join("/")}`;

  return <Stack gap="md">
    {draftApplied ? <Alert color="blue" icon={<Info size={18} />} title="AI draft applied">Review every value below. The Actor will run only after you confirm and select Start run.</Alert> : null}
    <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
      <Box style={{ flex: "1 1 420px" }}>
        <Text fw={650} size="sm">Set up this Actor</Text>
        <Text size="sm" c="dimmed" lineClamp={2}>{guide.description ? shortText(guide.description, 220) : "Complete the required fields, review the optional settings, then confirm the run."}</Text>
      </Box>
      <Group gap="xs" wrap="wrap">
        {exampleAvailable && !initialInput ? <Anchor href={`/app/leads/scrape/new?source=${encodeURIComponent(sourceId)}&example=1`} size="sm">Use sample</Anchor> : null}
        <ActorGuideDrawer
          sourceId={sourceId}
          actorTitle={guide.title || sourceSlug}
          actorUrl={actorUrl}
          readmeMarkdown={readmeMarkdown}
          structuredGuide={structuredGuide}
          buildNumber={buildNumber}
          contractHash={contractHash}
          fetchedAt={fetchedAt}
          stale={stale}
          canManage={canManage}
          pricingModel={pricingModel}
        />
      </Group>
    </Group>
    {requiredUnsupported.length ? <Alert color="red" icon={<TriangleAlert size={18} />} title="Some required inputs need attention">
      <Stack gap={4}>{requiredUnsupported.map((field) => <Text size="sm" key={field.name}><strong>{field.label}:</strong> {field.reason}</Text>)}</Stack>
    </Alert> : null}
    {requiredUnsupported.length && jsonFallbackSafe ? <ActionForm action={startActorScrapeAction} submitLabel={t("start")} redirectTo="/app/leads/scrape/{id}">
      <input type="hidden" name="source_id" defaultValue={sourceId} />
      <input type="hidden" name="contract_hash" defaultValue={contractHash || ""} />
      <Alert color="blue" title="Validated JSON fallback">Bizcraw cannot represent every required editor. Paste the complete Actor input below; it will be validated against the current contract before the run.</Alert>
      <Textarea name="actor_json_input" label="Complete Actor input JSON" defaultValue={JSON.stringify(initialInput || {}, null, 2)} minRows={12} autosize required />
      <Checkbox name="run_confirmed" label={t("runConfirmed")} required />
    </ActionForm> : requiredUnsupported.length ? null : <ActionForm action={startActorScrapeAction} submitLabel={t("start")} redirectTo="/app/leads/scrape/{id}">
      <input type="hidden" name="source_id" defaultValue={sourceId} />
      <input type="hidden" name="contract_hash" defaultValue={contractHash || ""} />
      {primaryRootFields.length ? <FieldGrid fields={primaryRootFields} highlightedNames={highlightedNames} /> : null}
      {additionalRootFields.length ? <Box component="details" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 10, padding: "12px 14px" }}>
        <Box component="summary" style={{ cursor: "pointer" }}><Text component="span" fw={650} size="sm">More options ({additionalRootFields.length})</Text></Box>
        <Box pt="md"><FieldGrid fields={additionalRootFields} highlightedNames={highlightedNames} /></Box>
      </Box> : null}
      {titledSections.map((section, index) => <Box component="details" key={`${section.title}-${index}`} open={section.fields.some((field) => field.required) || undefined} style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 10, padding: "12px 14px" }}>
        <Box component="summary" style={{ cursor: "pointer" }}>
          <Group component="span" gap="xs"><Text component="span" fw={650} size="sm">{plainText(section.title)}</Text><Badge component="span" size="xs" variant="light" color={section.fields.some((field) => field.required) ? "red" : "gray"}>{section.fields.length}</Badge></Group>
          {section.description ? <Text size="xs" c="dimmed" mt={3} lineClamp={1}>{shortText(section.description, 150)}</Text> : null}
        </Box>
        <Box pt="md"><FieldGrid fields={section.fields} highlightedNames={highlightedNames} /></Box>
      </Box>)}
      {unsupported.length && !requiredUnsupported.length ? <Text size="xs" c="dimmed">Some provider-specific controls are available only on Apify. Open the guide for details.</Text> : null}
      <Checkbox name="run_confirmed" label={t("runConfirmed")} required />
    </ActionForm>}
  </Stack>;
}
