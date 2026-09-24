import { Stack, Text } from "@mantine/core";
import { ActionForm } from "@/features/crm/components/action-form";
import { addNoteAction } from "@/features/tasks/server/actions";
import { NativeSelect, Textarea, TextInput } from "@mantine/core";

export function NoteForm({
  companyId,
  contactId,
  dealId,
  leadId,
  compact = false,
}: {
  companyId?: string;
  contactId?: string;
  dealId?: string;
  leadId?: string;
  /** Single-row composer: type, note, submit. */
  compact?: boolean;
}) {
  const ids = (
    <>
      {companyId ? <input type="hidden" name="company_id" value={companyId} /> : null}
      {contactId ? <input type="hidden" name="contact_id" value={contactId} /> : null}
      {dealId ? <input type="hidden" name="deal_id" value={dealId} /> : null}
      {leadId ? <input type="hidden" name="lead_id" value={leadId} /> : null}
    </>
  );
  const types = [
    { value: "note", label: "Note" },
    { value: "call", label: "Call" },
    { value: "meeting", label: "Meeting" },
  ];

  if (compact) {
    return (
      <ActionForm action={addNoteAction} submitLabel="Add" layout="inline">
        {ids}
        <NativeSelect name="activity_type" aria-label="Type" data={types} w={130} />
        <Textarea
          name="body"
          placeholder="Write a note"
          required
          autosize
          minRows={1}
          maxRows={4}
          style={{ flex: "1 1 220px" }}
        />
      </ActionForm>
    );
  }

  return (
    <ActionForm action={addNoteAction} submitLabel="Add note">
      {ids}
      <NativeSelect name="activity_type" label="Type" data={types} />
      <TextInput name="title" label="Title" defaultValue="Note" />
      <Textarea name="body" label="Body" minRows={3} required />
    </ActionForm>
  );
}

export function ActivityList({
  items,
}: {
  items: { id: string; title: string; body: string | null; activity_type: string; occurred_at: string }[];
}) {
  if (!items.length) {
    return (
      <Text size="sm" c="dimmed" mt="md">
        Chưa có activity.
      </Text>
    );
  }
  return (
    <Stack gap="sm" mt="md">
      {items.map((item) => {
        const body = readableActivityBody(item.activity_type, item.body);
        return (
          <div key={item.id}>
            <Text size="sm" fw={600}>
              {item.title}
            </Text>
            <Text size="xs" c="dimmed">
              {labelize(item.activity_type)} · {formatActivityTime(item.occurred_at)}
            </Text>
            {body ? (
              <Text size="sm" mt={4} style={{ whiteSpace: "pre-line" }}>
                {body}
              </Text>
            ) : null}
          </div>
        );
      })}
    </Stack>
  );
}

function labelize(value: string) {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Note";
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readableActivityBody(activityType: string, body: string | null) {
  if (!body) return null;
  if (activityType !== "ai_recommendation") return body;
  try {
    const parsed = JSON.parse(body) as { summary?: string; nextBestAction?: string; risks?: string[] };
    return [parsed.summary, parsed.nextBestAction, parsed.risks?.length ? `Risks: ${parsed.risks.join(", ")}` : ""]
      .filter(Boolean)
      .join("\n");
  } catch {
    return body;
  }
}
