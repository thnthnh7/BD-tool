import { Alert, Anchor, Badge, Box, Checkbox, Group, NativeSelect, SimpleGrid, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { BookOpen, ExternalLink, Info, TriangleAlert } from "lucide-react";
import { ActionForm } from "@/features/crm/components/action-form";
import { actorInputGuide, readableActorFields, unsupportedActorFields, type ActorField } from "@/features/leads/actor-input";
import { startActorScrapeAction } from "@/features/leads/server/scrape-actions";
import type { Json } from "@/lib/database.types";
import { useTranslations } from "next-intl";
import { ActorGuideDrawer } from "@/features/leads/components/actor-guide-drawer";

type FieldSection = { title: string; description: string; fields: ActorField[] };

function plainText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 — $2")
    .replace(/[*_`]+/g, "")
    .trim();
}

function actorSections(fields: ActorField[]) {
  const sections: FieldSection[] = [{ title: "", description: "", fields: [] }];
  for (const field of fields) {
    if (field.sectionCaption) sections.push({ title: field.sectionCaption, description: field.sectionDescription, fields: [] });
    sections.at(-1)?.fields.push(field);
  }
  return sections.filter((section) => section.fields.length);
}

function fieldHelp(field: ActorField, listHint: string) {
  const notes = [plainText(field.description)];
  if (field.kind === "stringList" || field.kind === "urlList") notes.push(listHint);
  if (field.unit) notes.push(`Unit: ${field.unit}`);
  if (field.minimum != null && field.maximum != null) notes.push(`Allowed range: ${field.minimum}–${field.maximum}`);
  else if (field.minimum != null) notes.push(`Minimum: ${field.minimum}`);
  else if (field.maximum != null) notes.push(`Maximum: ${field.maximum}`);
  if (field.exampleValue) notes.push(`Example: ${field.exampleValue.replace(/\s+/g, " ").slice(0, 180)}`);
  return notes.filter(Boolean).join(" · ");
}

function FieldControl({ field }: { field: ActorField }) {
  const t = useTranslations("Scrape");
  const name = `in_${field.name}`;
  const description = fieldHelp(field, t("onePerLine"));
  const label = <Group gap={6} wrap="nowrap"><Text component="span" size="sm" fw={600}>{field.label}</Text>{field.required ? <Badge size="xs" color="red" variant="light">Required</Badge> : null}</Group>;
  if (field.kind === "boolean") return <Checkbox name={name} label={field.label} description={description || undefined} defaultChecked={field.defaultValue === "on"} />;
  if (field.kind === "enum") return <NativeSelect name={name} label={label} description={description || undefined} data={[{ value: "", label: t("choose") }, ...field.options]} defaultValue={field.defaultValue} required={field.required} />;
  if (field.kind === "text" || field.kind === "stringList" || field.kind === "urlList" || field.kind === "json") {
    return <Textarea name={name} label={label} description={description || undefined} defaultValue={field.defaultValue} required={field.required} minRows={field.kind === "json" ? 5 : 2} maxRows={field.kind === "json" ? 12 : 6} autosize />;
  }
  return <TextInput
    name={name}
    type={field.secret ? "password" : field.kind === "number" ? "number" : "text"}
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
  />;
}

function FieldGrid({ fields }: { fields: ActorField[] }) {
  return <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
    {fields.map((field) => {
      const wide = field.kind === "text" || field.kind === "stringList" || field.kind === "urlList" || field.kind === "json";
      return <Box key={field.name} style={wide ? { gridColumn: "1 / -1" } : undefined}><FieldControl field={field} /></Box>;
    })}
  </SimpleGrid>;
}

export function ActorInputForm({ sourceId, sourceSlug, schema, example, readmeMarkdown = "", buildNumber = null, contractHash = null, fetchedAt = null, stale = false, canManage = false }: {
  sourceId: string;
  sourceSlug: string;
  schema: Json;
  example: Json | null;
  readmeMarkdown?: string;
  buildNumber?: string | null;
  contractHash?: string | null;
  fetchedAt?: string | null;
  stale?: boolean;
  canManage?: boolean;
}) {
  const t = useTranslations("Scrape");
  const guide = actorInputGuide(schema);
  const fields = readableActorFields(schema, example);
  const unsupported = unsupportedActorFields(schema);
  const requiredUnsupported = unsupported.filter((field) => field.required);
  const sections = actorSections(fields);
  const actorUrl = `https://apify.com/${sourceSlug.split("/").map(encodeURIComponent).join("/")}`;

  return <Stack gap="md">
    <ActorGuideDrawer
      sourceId={sourceId}
      actorTitle={guide.title || sourceSlug}
      actorUrl={actorUrl}
      readmeMarkdown={readmeMarkdown}
      buildNumber={buildNumber}
      contractHash={contractHash}
      fetchedAt={fetchedAt}
      stale={stale}
      canManage={canManage}
    />
    {guide.description ? <Alert color="teal" icon={<Info size={18} />} title={guide.title || "How to use this Actor"}><Text size="sm" style={{ whiteSpace: "pre-line" }}>{plainText(guide.description)}</Text></Alert> : null}
    <Group justify="space-between" align="center">
      <Group gap="xs"><BookOpen size={17} /><Text size="sm" fw={600}>Actor input guide</Text></Group>
      <Anchor href={actorUrl} target="_blank" rel="noreferrer" size="sm">View full guide on Apify <ExternalLink size={13} style={{ verticalAlign: "middle" }} /></Anchor>
    </Group>
    {unsupported.length ? <Alert color={requiredUnsupported.length ? "red" : "yellow"} icon={<TriangleAlert size={18} />} title={requiredUnsupported.length ? "This Actor needs an input Bizcraw cannot render yet" : "Some advanced inputs are not shown"}>
      <Text size="sm">{unsupported.map((field) => `${field.label}${field.required ? " (required)" : ""}`).join(", ")}</Text>
    </Alert> : null}
    {requiredUnsupported.length ? null : <ActionForm action={startActorScrapeAction} submitLabel={t("start")} redirectTo="/app/leads/scrape/{id}">
      <input type="hidden" name="source_id" defaultValue={sourceId} />
      <Text size="sm" c="dimmed">{t("actorInputHelp")}</Text>
      {sections.map((section, index) => section.title ? <Box component="details" key={`${section.title}-${index}`} open={index === 0 || undefined} style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 10, padding: "12px 14px" }}>
        <Box component="summary" style={{ cursor: "pointer" }}><Text component="span" fw={650} size="sm">{section.title}</Text>{section.description ? <Text size="xs" c="dimmed" mt={3}>{plainText(section.description)}</Text> : null}</Box>
        <Box pt="md"><FieldGrid fields={section.fields} /></Box>
      </Box> : <FieldGrid key={`main-${index}`} fields={section.fields} />)}
      <Checkbox name="run_confirmed" label={t("runConfirmed")} required />
    </ActionForm>}
  </Stack>;
}
