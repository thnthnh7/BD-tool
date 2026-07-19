"use client";

import Image from "next/image";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  MonitorPlay,
  PackagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { AiBriefResult } from "@/lib/ai/types";
import { exportContractDocx } from "@/lib/contracts/generate-docx";
import { deliverablesFromItems } from "@/lib/deliverables";
import { exportQuoteToExcel, exportQuoteToPdf } from "@/lib/exports";
import { fileToCompressedDataUrl } from "@/lib/image";
import { encodeSharedQuote } from "@/lib/share";
import { createId, createPublicId, loadAppData, resetAppData, saveAppData } from "@/lib/storage";
import { calculateQuoteTotals, formatVnd } from "@/lib/money";
import type {
  AppData,
  Client,
  DeliverableItem,
  DeliverablePriority,
  PaymentMilestone,
  ProjectType,
  Quote,
  QuoteItem,
  ServiceModule,
} from "@/lib/types";
import { AiBriefAssistant } from "./ai-brief-assistant";
import { Slideshow } from "./slideshow";

type View = "dashboard" | "new-quote" | "clients" | "modules" | "settings";

const projectTypes: ProjectType[] = ["Web App", "Mobile App", "MVP", "Internal Tool", "Maintenance", "Custom Software"];

const emptyClient = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  taxCode: "",
  address: "",
  representativeTitle: "",
  authorizationDoc: "",
  logoUrl: "",
  industry: "",
  notes: "",
};

const deliverablePriorities: DeliverablePriority[] = ["Cao", "Trung", "Thấp"];

function defaultPaymentMilestones(): PaymentMilestone[] {
  return [
    {
      id: createId("pay"),
      label: "Đợt 1",
      description: "Đặt cọc khởi động dự án",
      percent: 70,
      trigger: "Sau khi ký hợp đồng",
    },
    {
      id: createId("pay"),
      label: "Đợt 2",
      description: "Nghiệm thu hoàn chỉnh",
      percent: 30,
      trigger: "Sau khi nghiệm thu",
    },
  ];
}

function todayPlus(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createEmptyQuote(data: AppData, source?: Quote): Quote {
  const now = new Date().toISOString();
  return {
    id: createId("quote"),
    publicId: createPublicId(),
    clientId: source?.clientId || data.clients[0]?.id || "",
    title: source ? `${source.title} (Copy)` : "",
    projectType: source?.projectType || "Web App",
    status: "draft",
    currency: "VND",
    items: source?.items.map((item) => ({ ...item, id: createId("item") })) || [],
    discount: source?.discount || 0,
    vatRate: source?.vatRate ?? data.settings.vatRate,
    validUntil: todayPlus(data.settings.quoteValidityDays),
    projectOverview: source?.projectOverview || "",
    timeline: source?.timeline || "",
    nextSteps: source?.nextSteps || "",
    deliverables: source?.deliverables.map((d) => ({ ...d, id: createId("deliv") })) || [],
    contractNumber: source?.contractNumber || "",
    paymentMilestones: source?.paymentMilestones?.length
      ? source.paymentMilestones.map((m) => ({ ...m, id: createId("pay") }))
      : defaultPaymentMilestones(),
    techStack: source?.techStack?.length ? [...source.techStack] : ["React.js", "Next.js", "Tailwind CSS", "PostgreSQL"],
    warrantyMonths: source?.warrantyMonths ?? data.settings.defaultWarrantyMonths,
    maintenanceFeeMonthly: source?.maintenanceFeeMonthly ?? data.settings.defaultMaintenanceFee,
    createdAt: now,
    updatedAt: now,
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none transition focus:border-zinc-900 ${props.className || ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-900 ${props.className || ""}`}
    />
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 ${props.className || ""}`}
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 ${props.className || ""}`}
    />
  );
}

function ShellNav({
  activeView,
  setActiveView,
}: {
  activeView: View;
  setActiveView: (view: View) => void;
}) {
  const nav = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "new-quote" as const, label: "Tạo báo giá", icon: BriefcaseBusiness },
    { id: "clients" as const, label: "Khách hàng", icon: Users },
    { id: "modules" as const, label: "Module catalog", icon: PackagePlus },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-zinc-200 bg-white p-5 lg:block">
      <div className="flex items-center gap-3">
        <Image src="/brand/logo.jpg" alt="CJTEK" width={44} height={44} className="rounded-2xl" priority />
        <div>
          <p className="text-sm font-black">CJTEK</p>
          <p className="text-xs text-zinc-500">BD Quote Tool</p>
        </div>
      </div>
      <nav className="mt-10 space-y-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                active ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="absolute bottom-5 left-5 right-5 rounded-3xl bg-[#2FF29E] p-4 text-black">
        <p className="text-xs font-bold uppercase tracking-[0.2em]">Local-first</p>
        <p className="mt-2 text-sm font-semibold">Dữ liệu lưu trên browser. Link khách chứa dữ liệu báo giá đã mã hóa.</p>
      </div>
    </aside>
  );
}

function Dashboard({
  data,
  onNewQuote,
  onEdit,
  onClone,
}: {
  data: AppData;
  onNewQuote: () => void;
  onEdit: (quote: Quote) => void;
  onClone: (quote: Quote) => void;
}) {
  const sentValue = data.quotes
    .filter((quote) => quote.status === "sent" || quote.status === "won")
    .reduce((sum, quote) => sum + calculateQuoteTotals(quote).grandTotal, 0);

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-zinc-950 p-8 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#2FF29E]">BD Quote Tool</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
          Tạo báo giá software chuyên nghiệp trong vài phút.
        </h1>
        <p className="mt-5 max-w-2xl text-zinc-300">
          Chọn khách hàng, thêm module, chỉnh giá thủ công, preview slideshow và xuất Excel/PDF cho khách từ cùng một flow.
        </p>
        <PrimaryButton onClick={onNewQuote} className="mt-8 bg-[#2FF29E] text-black hover:bg-[#25d98b]">
          Tạo báo giá mới <ArrowRight size={18} />
        </PrimaryButton>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Báo giá" value={String(data.quotes.length)} />
        <Metric label="Khách hàng" value={String(data.clients.length)} />
        <Metric label="Pipeline sent/won" value={formatVnd(sentValue)} />
      </div>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Báo giá gần đây</h2>
            <p className="text-sm text-zinc-500">Clone hoặc chỉnh sửa báo giá, xuất hợp đồng DOCX.</p>
          </div>
        </div>
        <div className="mt-5 divide-y divide-zinc-100">
          {data.quotes.length ? (
            data.quotes.slice(0, 8).map((quote) => {
              const client = data.clients.find((item) => item.id === quote.clientId);
              const canExport = Boolean(quote.title.trim() && quote.clientId && quote.items.length);
              return (
                <div key={quote.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-bold">{quote.title || "Untitled quote"}</p>
                    <p className="text-sm text-zinc-500">
                      {client?.companyName || "Chưa chọn khách"} · {quote.status} · {formatVnd(calculateQuoteTotals(quote).grandTotal)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton onClick={() => onEdit(quote)} className="py-2">
                      <Pencil size={16} /> Sửa
                    </SecondaryButton>
                    <SecondaryButton onClick={() => onClone(quote)} className="py-2">
                      <RotateCcw size={16} /> Clone
                    </SecondaryButton>
                    {canExport ? (
                      <SecondaryButton onClick={() => exportContractDocx(data.settings, quote, client || null)} className="py-2">
                        <FileText size={16} /> DOCX
                      </SecondaryButton>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-300 p-10 text-center">
              <p className="font-bold">Chưa có báo giá nào.</p>
              <p className="mt-2 text-sm text-zinc-500">Bắt đầu bằng việc tạo khách hàng hoặc tạo báo giá mới.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2rem] border border-zinc-200 bg-white p-6">
      <p className="text-sm font-semibold text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function ClientsPanel({ data, setData }: { data: AppData; setData: (data: AppData) => void }) {
  const [form, setForm] = useState(emptyClient);
  const [logoBusy, setLogoBusy] = useState(false);

  function addClient() {
    if (!form.companyName.trim()) return;
    const client: Client = { ...form, id: createId("client"), createdAt: new Date().toISOString() };
    setData({ ...data, clients: [client, ...data.clients] });
    setForm(emptyClient);
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    setLogoBusy(true);
    try {
      const logoUrl = await fileToCompressedDataUrl(file);
      setForm((prev) => ({ ...prev, logoUrl }));
    } catch {
      window.alert("Không xử lý được ảnh logo. Thử file JPG/PNG nhỏ hơn.");
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-black">Thêm khách hàng</h1>
        <div className="mt-6 space-y-4">
          <div>
            <FieldLabel>Tên công ty</FieldLabel>
            <TextInput value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
          </div>
          <div>
            <FieldLabel>Người liên hệ</FieldLabel>
            <TextInput value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Email</FieldLabel>
              <TextInput value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <div>
              <FieldLabel>Điện thoại</FieldLabel>
              <TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Mã số thuế</FieldLabel>
              <TextInput value={form.taxCode} onChange={(event) => setForm({ ...form, taxCode: event.target.value })} />
            </div>
            <div>
              <FieldLabel>Chức danh người đại diện</FieldLabel>
              <TextInput
                value={form.representativeTitle}
                onChange={(event) => setForm({ ...form, representativeTitle: event.target.value })}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Địa chỉ</FieldLabel>
            <TextInput value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </div>
          <div>
            <FieldLabel>Logo khách (URL hoặc upload)</FieldLabel>
            <TextInput
              value={form.logoUrl}
              onChange={(event) => setForm({ ...form, logoUrl: event.target.value })}
              placeholder="https://... hoặc upload bên dưới"
            />
            <div className="mt-3 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-bold hover:bg-zinc-100">
                {logoBusy ? "Đang nén ảnh..." : "Upload logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={logoBusy}
                  onChange={(event) => onLogoFile(event.target.files?.[0] || null)}
                />
              </label>
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="Logo preview" className="h-12 w-12 rounded-xl border border-zinc-200 object-contain bg-white" />
              ) : null}
              {form.logoUrl ? (
                <button type="button" className="text-xs font-bold text-red-600" onClick={() => setForm({ ...form, logoUrl: "" })}>
                  Xóa logo
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-zinc-500">Upload sẽ nén về ~200px để share link không bị quá dài.</p>
          </div>
          <div>
            <FieldLabel>Văn bản ủy quyền</FieldLabel>
            <TextInput
              value={form.authorizationDoc}
              onChange={(event) => setForm({ ...form, authorizationDoc: event.target.value })}
              placeholder="Số / ngày văn bản ủy quyền (nếu có)"
            />
          </div>
          <div>
            <FieldLabel>Ghi chú</FieldLabel>
            <TextArea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <PrimaryButton onClick={addClient}>
            <Plus size={18} /> Lưu khách hàng
          </PrimaryButton>
        </div>
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6">
        <h2 className="text-2xl font-black">Danh sách khách hàng</h2>
        <div className="mt-5 divide-y divide-zinc-100">
          {data.clients.map((client) => (
            <div key={client.id} className="flex gap-4 py-4">
              {client.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-zinc-200 object-contain bg-white" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#2FF29E] text-xs font-black text-black">
                  {client.companyName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{client.companyName}</p>
                <p className="text-sm text-zinc-500">{[client.contactName, client.email, client.phone].filter(Boolean).join(" · ")}</p>
                {client.taxCode ? <p className="mt-1 text-xs text-zinc-500">MST: {client.taxCode}</p> : null}
                {client.address ? <p className="mt-1 text-xs text-zinc-500">{client.address}</p> : null}
                {client.notes ? <p className="mt-2 text-sm text-zinc-600">{client.notes}</p> : null}
                <label className="mt-3 inline-flex cursor-pointer text-xs font-bold text-zinc-700 underline">
                  {logoBusy ? "Đang nén..." : client.logoUrl ? "Đổi logo" : "Thêm logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={logoBusy}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setLogoBusy(true);
                      try {
                        const logoUrl = await fileToCompressedDataUrl(file);
                        setData({
                          ...data,
                          clients: data.clients.map((item) => (item.id === client.id ? { ...item, logoUrl } : item)),
                        });
                      } catch {
                        window.alert("Không xử lý được ảnh logo.");
                      } finally {
                        setLogoBusy(false);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
          {!data.clients.length ? <p className="rounded-3xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">Chưa có khách hàng.</p> : null}
        </div>
      </section>
    </div>
  );
}

function ModulesPanel({ data, setData }: { data: AppData; setData: (data: AppData) => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState("");

  function addModule() {
    if (!name.trim()) return;
    const serviceModule: ServiceModule = {
      id: createId("module"),
      name,
      description,
      suggestedPrice: price,
      category: "Product",
      defaultQty: 1,
      visualHint: "Custom module",
    };
    setData({ ...data, modules: [serviceModule, ...data.modules] });
    setName("");
    setPrice(0);
    setDescription("");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-black">Module catalog</h1>
        <p className="mt-2 text-sm text-zinc-500">Catalog chỉ là gợi ý. Khi đưa vào quote, bạn vẫn sửa giá thủ công 100%.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_160px_auto]">
          <TextInput placeholder="Tên module mới" value={name} onChange={(event) => setName(event.target.value)} />
          <TextInput type="number" placeholder="Giá gợi ý" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
          <PrimaryButton onClick={addModule}>
            <Plus size={18} /> Thêm
          </PrimaryButton>
        </div>
        <TextArea
          className="mt-4"
          placeholder="Mô tả module"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.modules.map((module) => (
          <article key={module.id} className="rounded-[2rem] border border-zinc-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">{module.category}</p>
            <h3 className="mt-3 text-lg font-black">{module.name}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{module.description}</p>
            <p className="mt-4 font-black">{formatVnd(module.suggestedPrice)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ data, setData }: { data: AppData; setData: (data: AppData) => void }) {
  const settings = data.settings;

  function updateSettings(next: Partial<AppData["settings"]>) {
    setData({ ...data, settings: { ...settings, ...next } });
  }

  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-6">
      <div className="flex items-center gap-4">
        <Image src={settings.logoPath} alt={settings.shortName} width={72} height={72} className="rounded-3xl" />
        <div>
          <h1 className="text-2xl font-black">Company settings</h1>
          <p className="text-sm text-zinc-500">Thông tin này được dùng trên slideshow, Excel và PDF.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div>
          <FieldLabel>Tên công ty</FieldLabel>
          <TextInput value={settings.companyName} onChange={(event) => updateSettings({ companyName: event.target.value })} />
        </div>
        <div>
          <FieldLabel>Tên ngắn</FieldLabel>
          <TextInput value={settings.shortName} onChange={(event) => updateSettings({ shortName: event.target.value })} />
        </div>
        <div>
          <FieldLabel>Mã số thuế</FieldLabel>
          <TextInput value={settings.taxCode} onChange={(event) => updateSettings({ taxCode: event.target.value })} />
        </div>
        <div>
          <FieldLabel>Accent color</FieldLabel>
          <TextInput value={settings.accentColor} onChange={(event) => updateSettings({ accentColor: event.target.value })} />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Địa chỉ</FieldLabel>
          <TextInput value={settings.address} onChange={(event) => updateSettings({ address: event.target.value })} />
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <TextInput value={settings.email} onChange={(event) => updateSettings({ email: event.target.value })} />
        </div>
        <div>
          <FieldLabel>Điện thoại</FieldLabel>
          <TextInput value={settings.phone} onChange={(event) => updateSettings({ phone: event.target.value })} />
        </div>
        <div>
          <FieldLabel>VAT mặc định (%)</FieldLabel>
          <TextInput type="number" value={settings.vatRate} onChange={(event) => updateSettings({ vatRate: Number(event.target.value) })} />
        </div>
        <div>
          <FieldLabel>Hiệu lực báo giá (ngày)</FieldLabel>
          <TextInput
            type="number"
            value={settings.quoteValidityDays}
            onChange={(event) => updateSettings({ quoteValidityDays: Number(event.target.value) })}
          />
        </div>
        <div>
          <FieldLabel>Người đại diện pháp luật</FieldLabel>
          <TextInput
            value={settings.legalRepresentative}
            onChange={(event) => updateSettings({ legalRepresentative: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Chức danh người đại diện</FieldLabel>
          <TextInput
            value={settings.legalRepresentativeTitle}
            onChange={(event) => updateSettings({ legalRepresentativeTitle: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Số tài khoản ngân hàng</FieldLabel>
          <TextInput
            value={settings.bankAccountNumber}
            onChange={(event) => updateSettings({ bankAccountNumber: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Tên tài khoản</FieldLabel>
          <TextInput
            value={settings.bankAccountName}
            onChange={(event) => updateSettings({ bankAccountName: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Ngân hàng</FieldLabel>
          <TextInput value={settings.bankName} onChange={(event) => updateSettings({ bankName: event.target.value })} />
        </div>
        <div>
          <FieldLabel>Tiền tố số hợp đồng</FieldLabel>
          <TextInput
            value={settings.contractNumberPrefix}
            onChange={(event) => updateSettings({ contractNumberPrefix: event.target.value })}
            placeholder="VD: CSJ-HĐDV"
          />
        </div>
        <div>
          <FieldLabel>Bảo hành mặc định (tháng)</FieldLabel>
          <TextInput
            type="number"
            value={settings.defaultWarrantyMonths}
            onChange={(event) => updateSettings({ defaultWarrantyMonths: Number(event.target.value) })}
          />
        </div>
        <div>
          <FieldLabel>Phí bảo trì mặc định / tháng (VND)</FieldLabel>
          <TextInput
            type="number"
            value={settings.defaultMaintenanceFee}
            onChange={(event) => updateSettings({ defaultMaintenanceFee: Number(event.target.value) })}
          />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>About</FieldLabel>
          <TextArea value={settings.about} onChange={(event) => updateSettings({ about: event.target.value })} />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Terms (mỗi dòng là một điều khoản)</FieldLabel>
          <TextArea value={settings.terms.join("\n")} onChange={(event) => updateSettings({ terms: event.target.value.split("\n") })} />
        </div>
      </div>
    </section>
  );
}

function QuoteWizard({
  data,
  setData,
  initialQuote,
}: {
  data: AppData;
  setData: (data: AppData) => void;
  initialQuote: Quote | null;
}) {
  const [step, setStep] = useState(1);
  const [quote, setQuote] = useState<Quote>(() => initialQuote || createEmptyQuote(data));
  const [copied, setCopied] = useState(false);

  const client = data.clients.find((item) => item.id === quote.clientId) || null;
  const totals = calculateQuoteTotals(quote);
  const canSave = quote.title.trim() && quote.clientId && quote.items.length;

  function updateQuote(next: Partial<Quote>) {
    setQuote({ ...quote, ...next, updatedAt: new Date().toISOString() });
  }

  function addModule(module: ServiceModule) {
    const item: QuoteItem = {
      id: createId("item"),
      moduleId: module.id,
      name: module.name,
      description: module.description,
      qty: module.defaultQty,
      unitPrice: module.suggestedPrice,
    };
    updateQuote({ items: [...quote.items, item] });
  }

  function addCustomItem() {
    updateQuote({
      items: [
        ...quote.items,
        {
          id: createId("item"),
          name: "Hạng mục tùy chỉnh",
          description: "Mô tả phạm vi công việc.",
          qty: 1,
          unitPrice: 0,
        },
      ],
    });
  }

  function updateItem(itemId: string, next: Partial<QuoteItem>) {
    updateQuote({ items: quote.items.map((item) => (item.id === itemId ? { ...item, ...next } : item)) });
  }

  function removeItem(itemId: string) {
    updateQuote({ items: quote.items.filter((item) => item.id !== itemId) });
  }

  function addDeliverable() {
    const deliverable: DeliverableItem = {
      id: createId("deliv"),
      name: "Chức năng mới",
      description: "",
      priority: "Trung",
      effortDays: 1,
      referencePrice: 0,
      notes: "",
    };
    updateQuote({ deliverables: [...quote.deliverables, deliverable] });
  }

  function updateDeliverable(deliverableId: string, next: Partial<DeliverableItem>) {
    updateQuote({
      deliverables: quote.deliverables.map((item) => (item.id === deliverableId ? { ...item, ...next } : item)),
    });
  }

  function removeDeliverable(deliverableId: string) {
    updateQuote({ deliverables: quote.deliverables.filter((item) => item.id !== deliverableId) });
  }

  function generateDeliverablesFromModules() {
    updateQuote({ deliverables: deliverablesFromItems(quote.items) });
  }

  function applyAiBrief(brief: AiBriefResult) {
    const requestedProjectType = brief.projectType as ProjectType;
    const projectType = projectTypes.includes(requestedProjectType) ? requestedProjectType : "Custom Software";
    const existingItemsWarning =
      quote.items.length > 0
        ? window.confirm("Báo giá đang có line items. Thay thế bằng modules do AI đề xuất?")
        : true;
    if (!existingItemsWarning) return;

    const items: QuoteItem[] = brief.modules.map((module) => {
      const matched = data.modules.find(
        (catalogItem) => catalogItem.name.trim().toLowerCase() === module.name.trim().toLowerCase(),
      );
      return {
        id: createId("item"),
        moduleId: matched?.id,
        name: module.name,
        description: module.description,
        qty: Math.max(1, module.quantity),
        unitPrice: Math.max(0, module.unitPrice),
      };
    });

    const deliverables: DeliverableItem[] = brief.deliverables.map((deliverable) => ({
      id: createId("deliv"),
      name: deliverable.name,
      description: deliverable.description,
      moduleName: deliverable.moduleName,
      priority: deliverable.priority,
      effortDays: Math.max(0, deliverable.effortDays),
      referencePrice: Math.max(0, deliverable.referencePrice),
      notes: deliverable.acceptanceCriteria.length
        ? `Tiêu chí nghiệm thu: ${deliverable.acceptanceCriteria.join("; ")}`
        : "",
    }));

    const overviewParts = [
      brief.executiveSummary,
      brief.businessGoals.length ? `Mục tiêu: ${brief.businessGoals.join("; ")}` : "",
      brief.targetUsers.length ? `Người dùng: ${brief.targetUsers.join("; ")}` : "",
      brief.assumptions.length ? `Giả định: ${brief.assumptions.join("; ")}` : "",
      brief.outOfScope.length ? `Ngoài phạm vi: ${brief.outOfScope.join("; ")}` : "",
    ].filter(Boolean);

    updateQuote({
      title: brief.projectName || quote.title,
      projectType,
      projectOverview: overviewParts.join("\n\n"),
      items,
      deliverables,
      timeline: brief.timeline || quote.timeline,
      techStack: brief.recommendedTechStack.length ? brief.recommendedTechStack : quote.techStack,
      nextSteps: brief.clarifyingQuestions.length
        ? `Cần xác nhận với khách:\n${brief.clarifyingQuestions.map((question) => `- ${question}`).join("\n")}`
        : quote.nextSteps,
    });
  }

  function addPaymentMilestone() {
    const milestone: PaymentMilestone = {
      id: createId("pay"),
      label: `Đợt ${quote.paymentMilestones.length + 1}`,
      description: "",
      percent: 0,
      trigger: "",
    };
    updateQuote({ paymentMilestones: [...quote.paymentMilestones, milestone] });
  }

  function updatePaymentMilestone(milestoneId: string, next: Partial<PaymentMilestone>) {
    updateQuote({
      paymentMilestones: quote.paymentMilestones.map((item) => (item.id === milestoneId ? { ...item, ...next } : item)),
    });
  }

  function removePaymentMilestone(milestoneId: string) {
    updateQuote({ paymentMilestones: quote.paymentMilestones.filter((item) => item.id !== milestoneId) });
  }

  function saveQuote(nextStatus: Quote["status"] = quote.status) {
    if (!canSave) return;
    const saved = { ...quote, status: nextStatus, updatedAt: new Date().toISOString() };
    const exists = data.quotes.some((item) => item.id === saved.id);
    setData({ ...data, quotes: exists ? data.quotes.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...data.quotes] });
  }

  async function copyShareLink() {
    const payload = encodeSharedQuote({ settings: data.settings, client, quote });
    await navigator.clipboard.writeText(`${window.location.origin}/p?data=${payload}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black">Tạo báo giá</h1>
            <p className="text-sm text-zinc-500">4 bước: khách hàng, scope, timeline, review/export.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((item) => (
              <button
                key={item}
                onClick={() => setStep(item)}
                className={`rounded-full px-4 py-2 text-xs font-black ${step === item ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-600"}`}
              >
                Step {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {step === 1 ? (
        <div className="space-y-6">
          <AiBriefAssistant catalog={data.modules} onApply={applyAiBrief} />
          <section className="rounded-[2rem] border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-black">1. Khách hàng & dự án</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel>Khách hàng</FieldLabel>
                <select
                  value={quote.clientId}
                  onChange={(event) => updateQuote({ clientId: event.target.value })}
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-900"
                >
                  <option value="">Chọn khách hàng</option>
                  {data.clients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.companyName}
                    </option>
                  ))}
                </select>
                {!data.clients.length ? <p className="mt-2 text-xs text-amber-600">Hãy tạo khách hàng ở tab Khách hàng trước.</p> : null}
              </div>
              <div>
                <FieldLabel>Loại dự án</FieldLabel>
                <select
                  value={quote.projectType}
                  onChange={(event) => updateQuote({ projectType: event.target.value as ProjectType })}
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-900"
                >
                  {projectTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Tên dự án / báo giá</FieldLabel>
                <TextInput value={quote.title} onChange={(event) => updateQuote({ title: event.target.value })} />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Mục tiêu dự án</FieldLabel>
                <TextArea value={quote.projectOverview} onChange={(event) => updateQuote({ projectOverview: event.target.value })} />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
          <section className="rounded-[2rem] border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-black">2. Chọn scope từ catalog</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {data.modules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => addModule(module)}
                  className="rounded-[1.5rem] border border-zinc-200 p-4 text-left transition hover:border-zinc-950 hover:bg-zinc-50"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">{module.category}</p>
                  <h3 className="mt-3 font-black">{module.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{module.description}</p>
                  <p className="mt-3 font-bold">{formatVnd(module.suggestedPrice)}</p>
                </button>
              ))}
            </div>
          </section>

          <aside className="sticky top-6 h-fit rounded-[2rem] border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-black">Line items</h3>
              <SecondaryButton onClick={addCustomItem} className="px-3 py-2">
                <Plus size={14} /> Custom
              </SecondaryButton>
            </div>
            <div className="mt-4 space-y-3">
              {quote.items.map((item) => (
                <div key={item.id} className="rounded-2xl bg-zinc-50 p-3">
                  <TextInput value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} />
                  <TextArea
                    className="mt-2 min-h-20"
                    value={item.description}
                    onChange={(event) => updateItem(item.id, { description: event.target.value })}
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <TextInput type="number" value={item.qty} onChange={(event) => updateItem(item.id, { qty: Number(event.target.value) })} />
                    <TextInput
                      type="number"
                      value={item.unitPrice}
                      onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) })}
                    />
                  </div>
                  <button onClick={() => removeItem(item.id)} className="mt-2 text-xs font-bold text-red-600">
                    Xóa hạng mục
                  </button>
                </div>
              ))}
              {!quote.items.length ? <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500">Chưa có hạng mục nào.</p> : null}
            </div>
            <div className="mt-5 border-t border-zinc-100 pt-5">
              <div className="flex justify-between text-sm">
                <span>Tạm tính</span>
                <strong>{formatVnd(totals.subtotal)}</strong>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <TextInput type="number" value={quote.discount} onChange={(event) => updateQuote({ discount: Number(event.target.value) })} />
                <TextInput type="number" value={quote.vatRate} onChange={(event) => updateQuote({ vatRate: Number(event.target.value) })} />
              </div>
              <p className="mt-1 text-xs text-zinc-500">Ô trái: discount %, ô phải: VAT %</p>
              <div className="mt-4 rounded-2xl bg-zinc-950 p-4 text-white">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Tổng cộng</p>
                <p className="mt-2 text-2xl font-black">{formatVnd(totals.grandTotal)}</p>
              </div>
            </div>

            <div className="mt-5 border-t border-zinc-100 pt-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-black">Chức năng bàn giao</h3>
                <div className="flex gap-2">
                  <SecondaryButton onClick={generateDeliverablesFromModules} className="px-3 py-2 text-xs">
                    Sinh từ modules
                  </SecondaryButton>
                  <SecondaryButton onClick={addDeliverable} className="px-3 py-2 text-xs">
                    <Plus size={14} /> Thêm chức năng
                  </SecondaryButton>
                </div>
              </div>
              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
                {quote.deliverables.map((deliverable) => (
                  <div key={deliverable.id} className="rounded-2xl bg-zinc-50 p-3">
                    <TextInput
                      value={deliverable.name}
                      onChange={(event) => updateDeliverable(deliverable.id, { name: event.target.value })}
                      placeholder="Tên chức năng"
                    />
                    <TextArea
                      className="mt-2 min-h-16"
                      value={deliverable.description}
                      onChange={(event) => updateDeliverable(deliverable.id, { description: event.target.value })}
                      placeholder="Mô tả"
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={deliverable.priority}
                        onChange={(event) =>
                          updateDeliverable(deliverable.id, { priority: event.target.value as DeliverablePriority })
                        }
                        className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                      >
                        {deliverablePriorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                      <TextInput
                        type="number"
                        value={deliverable.effortDays ?? 0}
                        onChange={(event) => updateDeliverable(deliverable.id, { effortDays: Number(event.target.value) })}
                        placeholder="Effort (ngày)"
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <TextInput
                        type="number"
                        value={deliverable.referencePrice ?? 0}
                        onChange={(event) => updateDeliverable(deliverable.id, { referencePrice: Number(event.target.value) })}
                        placeholder="Giá tham chiếu"
                      />
                      <TextInput
                        value={deliverable.notes || ""}
                        onChange={(event) => updateDeliverable(deliverable.id, { notes: event.target.value })}
                        placeholder="Ghi chú"
                      />
                    </div>
                    <button onClick={() => removeDeliverable(deliverable.id)} className="mt-2 text-xs font-bold text-red-600">
                      Xóa chức năng
                    </button>
                  </div>
                ))}
                {!quote.deliverables.length ? (
                  <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500">Chưa có chức năng bàn giao. Sinh từ modules hoặc thêm thủ công.</p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {step === 3 ? (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-black">3. Timeline, hợp đồng & thanh toán</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <FieldLabel>Hiệu lực báo giá</FieldLabel>
              <TextInput type="date" value={quote.validUntil} onChange={(event) => updateQuote({ validUntil: event.target.value })} />
            </div>
            <div>
              <FieldLabel>Số hợp đồng</FieldLabel>
              <TextInput
                value={quote.contractNumber}
                onChange={(event) => updateQuote({ contractNumber: event.target.value })}
                placeholder="Để trống để tự sinh khi xuất DOCX"
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Timeline</FieldLabel>
              <TextArea value={quote.timeline} onChange={(event) => updateQuote({ timeline: event.target.value })} />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Next steps</FieldLabel>
              <TextArea value={quote.nextSteps} onChange={(event) => updateQuote({ nextSteps: event.target.value })} />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Tech stack (phân tách bằng dấu phẩy)</FieldLabel>
              <TextInput
                value={quote.techStack.join(", ")}
                onChange={(event) =>
                  updateQuote({
                    techStack: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div>
              <FieldLabel>Bảo hành (tháng)</FieldLabel>
              <TextInput
                type="number"
                value={quote.warrantyMonths}
                onChange={(event) => updateQuote({ warrantyMonths: Number(event.target.value) })}
              />
            </div>
            <div>
              <FieldLabel>Phí bảo trì / tháng (VND)</FieldLabel>
              <TextInput
                type="number"
                value={quote.maintenanceFeeMonthly}
                onChange={(event) => updateQuote({ maintenanceFeeMonthly: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">Các đợt thanh toán</h3>
              <SecondaryButton onClick={addPaymentMilestone} className="px-3 py-2">
                <Plus size={14} /> Thêm đợt
              </SecondaryButton>
            </div>
            <div className="mt-4 space-y-3">
              {quote.paymentMilestones.map((milestone) => (
                <div key={milestone.id} className="rounded-2xl bg-zinc-50 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>Nhãn đợt</FieldLabel>
                      <TextInput
                        value={milestone.label}
                        onChange={(event) => updatePaymentMilestone(milestone.id, { label: event.target.value })}
                      />
                    </div>
                    <div>
                      <FieldLabel>Phần trăm (%)</FieldLabel>
                      <TextInput
                        type="number"
                        value={milestone.percent}
                        onChange={(event) => updatePaymentMilestone(milestone.id, { percent: Number(event.target.value) })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FieldLabel>Mô tả</FieldLabel>
                      <TextInput
                        value={milestone.description}
                        onChange={(event) => updatePaymentMilestone(milestone.id, { description: event.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FieldLabel>Điều kiện kích hoạt</FieldLabel>
                      <TextInput
                        value={milestone.trigger}
                        onChange={(event) => updatePaymentMilestone(milestone.id, { trigger: event.target.value })}
                      />
                    </div>
                  </div>
                  <button onClick={() => removePaymentMilestone(milestone.id)} className="mt-3 text-xs font-bold text-red-600">
                    Xóa đợt thanh toán
                  </button>
                </div>
              ))}
              {!quote.paymentMilestones.length ? (
                <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500">Chưa có đợt thanh toán nào.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-zinc-200 bg-white p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black">4. Review & export</h2>
                <p className="text-sm text-zinc-500">
                  Tổng: <strong className="text-zinc-950">{formatVnd(totals.grandTotal)}</strong>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={!canSave} onClick={() => saveQuote("draft")}>
                  <Save size={16} /> Lưu draft
                </PrimaryButton>
                <SecondaryButton disabled={!canSave} onClick={() => saveQuote("sent")}>
                  <Check size={16} /> Mark sent
                </SecondaryButton>
                <SecondaryButton disabled={!canSave} onClick={copyShareLink}>
                  <Copy size={16} /> {copied ? "Đã copy" : "Copy link"}
                </SecondaryButton>
                <SecondaryButton disabled={!canSave} onClick={() => exportQuoteToExcel(data.settings, quote, client)}>
                  <FileSpreadsheet size={16} /> Excel
                </SecondaryButton>
                <SecondaryButton disabled={!canSave} onClick={() => exportQuoteToPdf(data.settings, quote, client)}>
                  <MonitorPlay size={16} /> PDF
                </SecondaryButton>
                <SecondaryButton disabled={!canSave} onClick={() => exportContractDocx(data.settings, quote, client)}>
                  <FileText size={16} /> Xuất hợp đồng DOCX
                </SecondaryButton>
              </div>
            </div>
            {!canSave ? <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-700">Cần chọn khách, đặt tên dự án và có ít nhất 1 hạng mục.</p> : null}
          </section>
          <Slideshow settings={data.settings} quote={quote} client={client} />
        </div>
      ) : null}

      <div className="flex justify-between">
        <SecondaryButton disabled={step === 1} onClick={() => setStep(step - 1)}>
          Quay lại
        </SecondaryButton>
        <PrimaryButton disabled={step === 4} onClick={() => setStep(step + 1)}>
          Tiếp tục <ArrowRight size={18} />
        </PrimaryButton>
      </div>
    </div>
  );
}

export function BdToolApp() {
  const [data, setDataState] = useState<AppData>(() => loadAppData());
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [initialQuote, setInitialQuote] = useState<Quote | null>(null);

  function setData(next: AppData) {
    setDataState(next);
    saveAppData(next);
  }

  const content = useMemo(() => {

    if (activeView === "dashboard") {
      return (
        <Dashboard
          data={data}
          onNewQuote={() => {
            setInitialQuote(null);
            setActiveView("new-quote");
          }}
          onEdit={(quote) => {
            setInitialQuote(quote);
            setActiveView("new-quote");
          }}
          onClone={(quote) => {
            setInitialQuote(createEmptyQuote(data, quote));
            setActiveView("new-quote");
          }}
        />
      );
    }
    if (activeView === "clients") return <ClientsPanel data={data} setData={setData} />;
    if (activeView === "modules") return <ModulesPanel data={data} setData={setData} />;
    if (activeView === "settings") return <SettingsPanel data={data} setData={setData} />;
    return <QuoteWizard key={initialQuote?.id || "new-quote"} data={data} setData={setData} initialQuote={initialQuote} />;
  }, [activeView, data, initialQuote]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="flex">
        <ShellNav activeView={activeView} setActiveView={setActiveView} />
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <Image src="/brand/logo.jpg" alt="CJTEK" width={42} height={42} className="rounded-2xl" />
              <strong>CJTEK BD Tool</strong>
            </div>
            <select value={activeView} onChange={(event) => setActiveView(event.target.value as View)} className="rounded-xl border px-3 py-2 text-sm">
              <option value="dashboard">Dashboard</option>
              <option value="new-quote">Tạo báo giá</option>
              <option value="clients">Khách hàng</option>
              <option value="modules">Modules</option>
              <option value="settings">Settings</option>
            </select>
          </div>
          <div className="mx-auto max-w-7xl">{content}</div>
          <button
            onClick={() => {
              resetAppData();
              setDataState(loadAppData());
            }}
            className="mt-10 text-xs font-semibold text-zinc-400 hover:text-zinc-700"
          >
            Reset local demo data
          </button>
        </main>
      </div>
    </div>
  );
}
