import { requireModule } from "@/lib/auth/session";
import { Checkbox, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { notFound } from "next/navigation";
import surfaces from "@/styles/leadely-surfaces.module.css";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { ActionForm } from "@/features/crm/components/action-form";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { listCompanies, listContacts } from "@/features/companies/server/actions";
import { addSequenceStepAction, configureSequenceAction, enrollSequenceAction, getSequence, updateSequenceEnrollmentAction } from "@/features/comms/server/actions";
import { listEngagementAccounts } from "@/features/comms/server/accounts";
import { matchesQuery, readNamedQuery, slicePage } from "@/lib/list-page";

export default async function SequenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireModule("sequences");
  const { id } = await params;
  const query = await searchParams;
  const stepsQuery = readNamedQuery(query, "step");
  const enrollQuery = readNamedQuery(query, "enroll");
  const payload = await getSequence(id);
  if (!payload) notFound();
  const [companies, contacts, accounts] = await Promise.all([listCompanies(), listContacts(), listEngagementAccounts()]);
  const sequencePath = `/app/sequences/${payload.sequence.id}`;
  const matchedSteps = payload.steps.filter((step) => matchesQuery(stepsQuery.q, [step.step_type, step.subject, step.body, step.delay_days]));
  const stepPage = slicePage(matchedSteps, stepsQuery.page);
  const matchedEnrollments = payload.enrollments.filter((row) =>
    matchesQuery(enrollQuery.q, [
      (row.companies as { name?: string } | null)?.name,
      (row.contacts as { display_name?: string } | null)?.display_name,
      row.status,
    ]),
  );
  const enrollPage = slicePage(matchedEnrollments, enrollQuery.page);
  const stepExtra = { enroll: enrollQuery.q, enrollPage: enrollQuery.page > 1 ? String(enrollQuery.page) : "" };
  const enrollExtra = { step: stepsQuery.q, stepPage: stepsQuery.page > 1 ? String(stepsQuery.page) : "" };

  return (
    <Stack gap="md">
      <PageHeader back={{ href: "/app/sequences", label: "Sequences" }} title={payload.sequence.name} subtitle={payload.sequence.description} />
      <SectionPanel title="Delivery settings">
        <ActionForm action={configureSequenceAction} submitLabel="Save settings">
          <input type="hidden" name="sequence_id" value={payload.sequence.id} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NativeSelect
              name="sender_account_id"
              label="Sending account"
              defaultValue={payload.sequence.sender_account_id || ""}
              data={[{ value: "", label: "Select a connected mailbox" }, ...accounts.filter((item) => item.status === "connected").map((item) => ({ value: item.id, label: `${item.account_email} (${item.provider})` }))]}
            />
            <NativeSelect
              name="status"
              label="Status"
              defaultValue={payload.sequence.status}
              data={[{ value: "draft", label: "Draft" }, { value: "active", label: "Active" }, { value: "paused", label: "Paused" }, { value: "archived", label: "Archived" }]}
            />
            <TextInput name="timezone" label="Timezone" defaultValue={payload.sequence.timezone} />
            <TextInput name="daily_send_limit" type="number" min={1} max={500} label="Daily mailbox limit" defaultValue={payload.sequence.daily_send_limit} />
          </SimpleGrid>
          <Checkbox name="stop_on_reply" defaultChecked={payload.sequence.stop_on_reply} label="Stop this contact when a reply is detected" />
        </ActionForm>
      </SectionPanel>
      <SectionPanel title="Steps">
        <ActionForm action={addSequenceStepAction} submitLabel="Add step">
          <input type="hidden" name="sequence_id" value={payload.sequence.id} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NativeSelect
              name="step_type"
              label="Type"
              data={[
                { value: "email", label: "Email" },
                { value: "task", label: "Task" },
                { value: "wait", label: "Wait" },
              ]}
            />
            <TextInput name="delay_days" type="number" label="Delay days" defaultValue="1" />
            <TextInput name="delay_minutes" type="number" label="Additional minutes" defaultValue="0" />
            <TextInput name="subject" label="Subject" style={{ gridColumn: "1 / -1" }} />
          </SimpleGrid>
          <Textarea name="body" label="Body" minRows={4} />
        </ActionForm>
        <Stack gap="xs" mt="md">
          <ListSearch path={sequencePath} q={stepsQuery.q} name="step" extra={stepExtra} placeholder="Loại bước, subject hoặc nội dung" />
          {stepPage.rows.map((step) => (
            <Paper key={step.id} withBorder radius="md" p="sm" className={surfaces.panel}>
              <Text fw={600} size="sm">
                {step.position}. {step.step_type} (+{step.delay_days}d)
              </Text>
              <Text size="sm" lineClamp={1}>
                {step.subject}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={3}>
                {step.body}
              </Text>
            </Paper>
          ))}
          {stepPage.total === 0 ? (
            <Text size="sm" c="dimmed">
              {stepsQuery.q ? "Không thấy step khớp." : "Chưa có step nào."}
            </Text>
          ) : (
            <ListFooter path={sequencePath} q={stepsQuery.q} name="step" extra={stepExtra} {...stepPage} singular="step" plural="steps" />
          )}
        </Stack>
      </SectionPanel>
      <SectionPanel title="Enroll">
        <ActionForm action={enrollSequenceAction} submitLabel="Enroll">
          <input type="hidden" name="sequence_id" value={payload.sequence.id} />
          <NativeSelect name="company_id" label="Company" data={[{ value: "", label: "—" }, ...companies.map((item) => ({ value: item.id, label: item.name }))]} />
          <NativeSelect name="contact_id" label="Contact" data={[{ value: "", label: "—" }, ...contacts.map((item) => ({ value: item.id, label: item.display_name }))]} />
        </ActionForm>
        <Stack gap="xs" mt="md">
          <ListSearch path={sequencePath} q={enrollQuery.q} name="enroll" extra={enrollExtra} placeholder="Công ty, contact hoặc trạng thái" />
        {enrollPage.total ? (
          <ListTable footer={<ListFooter path={sequencePath} q={enrollQuery.q} name="enroll" extra={enrollExtra} {...enrollPage} singular="enrollment" plural="enrollments" />}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Company</TableTh>
                <TableTh>Contact</TableTh>
                <TableTh>Status</TableTh>
                <TableTh>Next run / reason</TableTh>
                <TableTh>Actions</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {enrollPage.rows.map((row) => (
                <TableTr key={row.id}>
                  <TableTd>{(row.companies as { name?: string } | null)?.name || "—"}</TableTd>
                  <TableTd>{(row.contacts as { display_name?: string } | null)?.display_name || "—"}</TableTd>
                  <TableTd>{row.status}</TableTd>
                  <TableTd>
                    <Text size="xs">{row.next_run_at ? new Date(row.next_run_at).toLocaleString() : row.paused_reason || row.last_error || "—"}</Text>
                  </TableTd>
                  <TableTd>
                    <Group gap="xs" wrap="nowrap">
                      {row.status === "active" ? (
                        <ActionForm action={updateSequenceEnrollmentAction} submitLabel="Pause" variant="light">
                          <input type="hidden" name="enrollment_id" value={row.id} />
                          <input type="hidden" name="status" value="paused" />
                        </ActionForm>
                      ) : row.status === "paused" ? (
                        <ActionForm action={updateSequenceEnrollmentAction} submitLabel="Resume" variant="light">
                          <input type="hidden" name="enrollment_id" value={row.id} />
                          <input type="hidden" name="status" value="active" />
                        </ActionForm>
                      ) : null}
                      {row.status === "active" || row.status === "paused" ? (
                        <ActionForm action={updateSequenceEnrollmentAction} submitLabel="Stop" variant="light">
                          <input type="hidden" name="enrollment_id" value={row.id} />
                          <input type="hidden" name="status" value="stopped" />
                        </ActionForm>
                      ) : null}
                    </Group>
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
          </ListTable>
        ) : (
          <Text size="sm" c="dimmed">
            {enrollQuery.q ? "Không thấy enrollment khớp." : "Chưa có enrollment nào."}
          </Text>
        )}
        </Stack>
      </SectionPanel>
    </Stack>
  );
}
