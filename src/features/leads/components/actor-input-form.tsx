import { Box, Checkbox, NativeSelect, SimpleGrid, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { ActionForm } from "@/features/crm/components/action-form";
import { readableActorFields, type ActorField } from "@/features/leads/actor-input";
import { startActorScrapeAction } from "@/features/leads/server/scrape-actions";
import type { Json } from "@/lib/database.types";
import { useTranslations } from "next-intl";

const COMPACT_FROM = 6;

function FieldControl({ field }: { field: ActorField }) {
  const t = useTranslations("Scrape");
  const name = `in_${field.name}`;
  if (field.kind === "boolean") {
    return <Checkbox name={name} label={field.label} defaultChecked={field.defaultValue === "on"} />;
  }
  if (field.kind === "enum") {
    return (
      <NativeSelect
        name={name}
        label={field.label}
        data={[{ value: "", label: t("choose") }, ...field.options]}
        defaultValue={field.defaultValue}
        required={field.required}
      />
    );
  }
  if (field.kind === "text" || field.kind === "stringList") {
    return (
      <Textarea
        name={name}
        label={field.label}
        description={field.kind === "stringList" ? t("onePerLine") : undefined}
        defaultValue={field.defaultValue}
        required={field.required}
        minRows={2}
        maxRows={4}
        autosize
      />
    );
  }
  return (
    <TextInput
      name={name}
      type={field.kind === "number" ? "number" : "text"}
      label={field.label}
      defaultValue={field.defaultValue}
      required={field.required}
    />
  );
}

function FieldGroups({ fields }: { fields: ActorField[] }) {
  const long = fields.filter((field) => field.kind === "text" || field.kind === "stringList");
  const checks = fields.filter((field) => field.kind === "boolean");
  const short = fields.filter((field) => field.kind !== "text" && field.kind !== "stringList" && field.kind !== "boolean");
  return (
    <Stack gap="sm">
      {long.map((field) => (
        <FieldControl key={field.name} field={field} />
      ))}
      {short.length ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {short.map((field) => (
            <FieldControl key={field.name} field={field} />
          ))}
        </SimpleGrid>
      ) : null}
      {checks.length ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {checks.map((field) => (
            <FieldControl key={field.name} field={field} />
          ))}
        </SimpleGrid>
      ) : null}
    </Stack>
  );
}

export function ActorInputForm({
  sourceId,
  schema,
  example,
}: {
  sourceId: string;
  schema: Json;
  example: Json | null;
}) {
  const t = useTranslations("Scrape");
  const fields = readableActorFields(schema, example);
  const required = fields.filter((field) => field.required);
  const optional = fields.filter((field) => !field.required);
  const compact = fields.length > COMPACT_FROM;
  const primary = compact ? (required.length ? required : fields.slice(0, 4)) : fields;
  const extra = compact ? (required.length ? optional : fields.slice(4)) : [];

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {t("actorInputHelp")}
      </Text>
      <ActionForm action={startActorScrapeAction} submitLabel={t("start")} redirectTo="/app/leads/scrape/{id}">
        <input type="hidden" name="source_id" defaultValue={sourceId} />
        <FieldGroups fields={primary} />
        {extra.length ? (
          <Box component="details">
            <Text component="summary" fw={600} size="sm" style={{ cursor: "pointer" }}>
              {t("moreOptions", { count: extra.length })}
            </Text>
            <Box pt="sm">
              <FieldGroups fields={extra} />
            </Box>
          </Box>
        ) : null}
        <Checkbox name="run_confirmed" label={t("runConfirmed")} required />
      </ActionForm>
    </Stack>
  );
}
