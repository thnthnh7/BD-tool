import { Badge, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { ActionForm } from "@/features/crm/components/action-form";
import { createSequenceFromTemplateAction } from "@/features/comms/server/sequence-template-actions";
import { SEQUENCE_TEMPLATES } from "@/features/comms/sequence-templates";

export function SequenceTemplatePicker() {
  return <SimpleGrid cols={{ base: 1, md: 3 }}>
    {SEQUENCE_TEMPLATES.map((template) => <Paper key={template.id} withBorder radius="md" p="md">
      <Stack gap="sm" h="100%">
        <div><Text fw={650}>{template.name}</Text><Text size="sm" c="dimmed" mt={4}>{template.description}</Text></div>
        <Badge variant="light" w="fit-content">{template.steps.length} steps</Badge>
        <div style={{ marginTop: "auto" }}><ActionForm action={createSequenceFromTemplateAction} submitLabel="Use template" redirectTo="/app/sequences/{id}">
          <input type="hidden" name="template_id" value={template.id} />
        </ActionForm></div>
      </Stack>
    </Paper>)}
  </SimpleGrid>;
}
