import { notFound } from "next/navigation";
import { loadWorkspaceAppData } from "@/lib/db/actions";
import { QuoteEditor } from "@/components/bd-tool/quote-editor";
import { defaultSettings } from "@/lib/default-data";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { settings, clients, modules, quotes } = await loadWorkspaceAppData();
  const quote = quotes.find((item) => item.id === id);
  if (!quote) notFound();
  return <QuoteEditor settings={settings || defaultSettings} clients={clients} modules={modules} initialQuote={quote} />;
}
