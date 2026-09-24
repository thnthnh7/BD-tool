import { Alert, Badge, Checkbox, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { Radar } from "lucide-react";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { EmptyState } from "@/components/leadely/empty-state";
import { LinkButton } from "@/components/mantine-link";
import { ActionForm } from "@/features/crm/components/action-form";
import { ActorInputForm } from "@/features/leads/components/actor-input-form";
import { SourceChooser } from "@/features/leads/components/source-chooser";
import { ensureSourceContract } from "@/features/leads/server/actor-schema";
import { listInstalledSources } from "@/features/leads/server/source-actions";
import { getScrapeJob, startMapsScrapeAction } from "@/features/leads/server/scrape-actions";
import { isMapsActor } from "@/features/leads/maps-source";
import { requireWorkspace } from "@/lib/auth/session";
import { ApifyAccountStatus } from "@/features/leads/components/apify-account-status";
import { getCurrentWorkspaceApifyStatus, requireWorkspaceApifyConnection } from "@/features/leads/server/apify-connection";

export default async function NewScrapePage({ searchParams }: { searchParams: Promise<{ source?: string; rerun?: string }> }) {
  const params = await searchParams;
  const context = await requireWorkspace();
  const [sources, apify] = await Promise.all([listInstalledSources(), getCurrentWorkspaceApifyStatus()]);
  const previous = params.rerun ? await getScrapeJob(params.rerun) : null;
  const previousSource = previous && sources.find((source) => source.id === previous.job.source_id ||
    source.slug === previous.job.apify_actor_id.replaceAll("~", "/") || (isMapsActor(source.slug) && previous.job.apify_actor_id === "demo"));
  const requestedId = params.source || previousSource?.id;
  const selected = sources.find((source) => source.id === requestedId) || sources[0];
  const rerunUnavailable = Boolean(params.rerun && !previousSource);
  const maps = selected && isMapsActor(selected.slug);
  const reuse = previous && !rerunUnavailable && selected?.id === previousSource?.id ? previous.job : null;
  const apifyCredential = apify.connection?.status === "active" ? await requireWorkspaceApifyConnection(context.workspaceId).catch(() => null) : null;
  const contract = selected && !maps && context.plan.features.lead_scrape && apifyCredential ? await ensureSourceContract(selected.id, apifyCredential.token) : null;

  return <Stack gap="md" w="100%" style={{ minWidth: 0 }}>
    <PageHeader back={{ href: "/app/leads/scrape", label: "Lịch sử scrape" }} title={reuse ? "Chạy lại với thông số cũ" : "Chạy scrape mới"} subtitle="Chọn actor, kiểm tra thông số rồi bắt đầu thu thập dữ liệu." action={<LinkButton href="/app/leads/sources" variant="default">Thêm nguồn</LinkButton>} />
    <ApifyAccountStatus connection={apify.connection} canManage={apify.canManage} oauthReady={apify.oauthReady} compact />
    {rerunUnavailable && <Alert color="yellow">Nguồn của lần chạy cũ chưa được cài hoặc không còn khả dụng. Chọn nguồn khác để tạo lần chạy mới.</Alert>}
    {!context.plan.features.lead_scrape && <Alert color="yellow">Gói hiện tại chưa hỗ trợ scrape. Owner có thể nâng gói trong Billing.</Alert>}
    {sources.length ? <SectionPanel><SourceChooser sources={sources} selectedId={selected?.id || ""} /></SectionPanel> : <SectionPanel><EmptyState icon={<Radar size={20} />} title="Chưa có nguồn đã cài" description="Vào Nguồn dữ liệu để cài actor bạn muốn sử dụng." /></SectionPanel>}
    {selected && <SectionPanel title={selected.title} action={<Badge color={maps ? "teal" : "gray"}>{maps ? "Hỗ trợ import CRM" : "Xem & xuất dataset"}</Badge>}>
      {context.plan.features.lead_scrape && apifyCredential && maps && selected.adapter_status === "ready" ? <ActionForm key={`${selected.id}-${reuse?.id || "new"}`} action={startMapsScrapeAction} submitLabel="Bắt đầu chạy" redirectTo="/app/leads/scrape/{id}">
        <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing={{ base: "sm", md: "md" }}>
          <TextInput name="query" label="Ngành / từ khóa" placeholder="công ty phần mềm" required defaultValue={reuse?.query} />
          <TextInput name="location" label="Khu vực" placeholder="Quận 1, Hồ Chí Minh, Việt Nam" required defaultValue={reuse?.location} />
          <TextInput name="language" label="Ngôn ngữ" defaultValue={reuse?.language || "vi"} />
          <TextInput name="max_results" type="number" min={1} max={50} label="Số địa điểm tối đa" defaultValue={String(reuse?.max_results || 20)} />
          <TextInput name="max_people_per_place" type="number" min={0} max={5} label="Số liên hệ / địa điểm" defaultValue={String(reuse?.max_people_per_place ?? 5)} />
        </SimpleGrid>
        <Checkbox name="enrich_people" label="Tìm thêm người liên hệ (email, chức danh, LinkedIn)" defaultChecked={reuse?.enrich_people ?? true} />
        <Checkbox name="verify_emails" label="Xác minh email (có thể phát sinh thêm phí Apify)" defaultChecked={reuse?.verify_emails ?? false} />
        <Checkbox name="pdpa_confirmed" label="Tôi xác nhận dùng dữ liệu liên hệ doanh nghiệp hợp lệ (PDPA)" required />
      </ActionForm> : context.plan.features.lead_scrape && apifyCredential && contract?.inputSchema ? <ActorInputForm key={`${selected.id}-${reuse?.id || "new"}`} sourceId={selected.id} schema={contract.inputSchema} example={reuse?.filters || contract.exampleInput} /> : <Text size="sm" c="dimmed">{!apifyCredential ? "Hãy kết nối tài khoản Apify của workspace trước khi chạy Actor." : contract?.error || "Nguồn này chưa sẵn sàng để chạy."}</Text>}
    </SectionPanel>}
    {selected && <Group><Text size="xs" c="dimmed">Kết quả được lưu riêng cho từng lần chạy. Dữ liệu chỉ vào CRM khi bạn chọn import.</Text></Group>}
  </Stack>;
}
