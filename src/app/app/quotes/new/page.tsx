import { loadWorkspaceAppData } from "@/lib/db/actions";
import { QuoteEditor } from "@/components/bd-tool/quote-editor";
import { defaultSettings } from "@/lib/default-data";
import { clientFromRow } from "@/lib/db/mappers";
import { ensureLegacyClientForCompany } from "@/features/companies/server/actions";
import { getDeal } from "@/features/deals/server/actions";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ dealId?: string; mode?: string }> }) {
  const { dealId, mode } = await searchParams;
  const { settings, clients, modules } = await loadWorkspaceAppData(["settings", "clients", "modules"]);
  let resolvedClients = clients;
  let seed: { dealId?: string; clientId?: string; title?: string } | undefined;

  if (dealId) {
    const deal = await getDeal(dealId);
    if (deal) {
      const client = await ensureLegacyClientForCompany(deal.company_id);
      if (client) {
        const mapped = clientFromRow(client);
        if (!resolvedClients.some((item) => item.id === mapped.id)) {
          resolvedClients = [mapped, ...resolvedClients];
        }
        seed = { dealId: deal.id, clientId: mapped.id, title: deal.title };
      } else {
        seed = { dealId: deal.id, title: deal.title };
      }
    }
  }

  return (
    <QuoteEditor settings={settings || defaultSettings} clients={resolvedClients} modules={modules} initialQuote={seed} mode={mode === "upload" ? "upload" : "quote"} />
  );
}
