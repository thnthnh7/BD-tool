import { requireModule } from "@/lib/auth/session";
import { FileInput, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { FileSignature, FileUp } from "lucide-react";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { EmptyState } from "@/components/leadely/empty-state";
import { ListFooter, ListSearch, ListTable } from "@/components/leadely/list-frame";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { StatusBadge } from "@/components/leadely/status-badge";
import { LinkAnchor } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { ContractEditor } from "@/features/deals/components/contract-editor";
import { listDeals } from "@/features/deals/server/actions";
import { createContractAction, listContracts } from "@/features/deals/server/intel";
import { loadWorkspaceAppData } from "@/lib/db/actions";
import { defaultSettings } from "@/lib/default-data";
import { matchesQuery, readListQuery, slicePage } from "@/lib/list-page";

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireModule("contracts");
  const { q, page } = readListQuery(await searchParams);
  const [contracts, deals, app] = await Promise.all([listContracts(), listDeals(), loadWorkspaceAppData(["settings", "quotes"])]);
  const settings = app.settings || defaultSettings;
  const matched = contracts.filter((contract) =>
    matchesQuery(q, [contract.title, contract.status, contract.notes, (contract.deals as { title?: string } | null)?.title]),
  );
  const paged = slicePage(matched, page);
  return (
    <Stack gap="md">
      <PageHeader title="Contracts" subtitle="Hợp đồng ký bằng DOCX, gắn với một deal và quote." />
      <div data-tutorial-id="contracts-create">
      <SectionPanel title="New contract">
        <ActionForm action={createContractAction} submitLabel="Create contract">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput name="title" label="Title" required style={{ gridColumn: "1 / -1" }} />
            <NativeSelect name="deal_id" label="Deal" data={deals.map((deal) => ({ value: deal.id, label: deal.title }))} />
            <NativeSelect
              name="quote_id"
              label="Quote"
              data={[{ value: "", label: "—" }, ...app.quotes.map((quote) => ({ value: quote.id, label: quote.title || quote.publicId }))]}
            />
          </SimpleGrid>
          <NativeSelect
            mt="md"
            maw={280}
            name="status"
            label="Status"
            data={["draft", "sent", "signed", "void"].map((item) => ({ value: item, label: item }))}
          />
          <Textarea name="notes" label="Notes" mt="md" />
          <FileInput
            name="docx"
            label="Contract file"
            description="DOCX, không bắt buộc. Tối đa 20 MB."
            placeholder="Chọn file DOCX để tải lên"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            clearable
            mt="md"
            leftSection={<FileUp size={16} />}
            leftSectionPointerEvents="none"
          />
        </ActionForm>
      </SectionPanel>
      </div>
      <div data-tutorial-id="contracts-list">
      <SectionPanel
        title="All contracts"
        padded={paged.total === 0}
        action={<ListSearch path="/app/contracts" q={q} placeholder="Tiêu đề, deal, trạng thái hoặc ghi chú" />}
      >
        {paged.total ? (
          <ListTable footer={<ListFooter path="/app/contracts" q={q} {...paged} singular="contract" plural="contracts" />}>
          <Table layout="fixed">
            <TableThead>
              <TableTr>
                <TableTh>Title</TableTh>
                <TableTh>Deal</TableTh>
                <TableTh>Quote</TableTh>
                <TableTh w={120}>Status</TableTh>
                <TableTh w={56} />
              </TableTr>
            </TableThead>
            <TableTbody>
              {paged.rows.map((contract) => {
                const quote = app.quotes.find((item) => item.id === contract.quote_id) || null;
                const client = app.clients.find((item) => item.id === quote?.clientId) || null;
                return (
                  <TableTr key={contract.id}>
                    <TableTd>
                      <Text size="sm" fw={600} lineClamp={1}>
                        {contract.title}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {contract.docx_name || "No file"}
                      </Text>
                    </TableTd>
                    <TableTd>
                      <LinkAnchor href={`/app/deals/${contract.deal_id}`} lineClamp={1}>
                        {(contract.deals as { title?: string } | null)?.title}
                      </LinkAnchor>
                    </TableTd>
                    <TableTd>
                      {quote ? (
                        <LinkAnchor href={`/app/quotes/${quote.id}`} lineClamp={1}>
                          {quote.title || "Quote"}
                        </LinkAnchor>
                      ) : (
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      )}
                    </TableTd>
                    <TableTd style={{ whiteSpace: "nowrap" }}>
                      <StatusBadge status={contract.status} />
                    </TableTd>
                    <TableTd ta="right">
                      <ContractEditor
                        id={contract.id}
                        title={contract.title}
                        status={contract.status}
                        notes={contract.notes || ""}
                        docxName={contract.docx_name}
                        settings={settings}
                        quote={quote}
                        client={client}
                      />
                    </TableTd>
                  </TableTr>
                );
              })}
            </TableTbody>
          </Table>
          </ListTable>
        ) : q ? (
          <Text size="sm" c="dimmed">Không thấy contract khớp.</Text>
        ) : (
          <EmptyState icon={<FileSignature size={18} />} title="No contracts" description="Tạo contract từ form phía trên để gắn với một deal." />
        )}
      </SectionPanel>
      </div>
    </Stack>
  );
}
