/**
 * Create (or refresh) the Leadely demo account and fill its workspace with CRM + quote mock data.
 *
 * Usage from repo root:
 *   npx tsx scripts/seed-demo.ts
 *
 * Set DEMO_PASSWORD in .env.local before running this script.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo@leadely.app";
let demoPassword = "";
const DEMO_WORKSPACE = "Leadely Demo";

type Stage = { id: string; name: string; stage_type: string; probability: number; pipeline_id: string };

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Save .env.local (Ctrl+S) with ${name}=... then retry. cwd=${process.cwd()} local=${existsSync(resolve(process.cwd(), ".env.local"))}`,
    );
  }
  return value;
}

async function must<T>(label: string, result: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await result;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${base || "ws"}-${randomBytes(3).toString("hex")}`;
}

function isoDaysFromNow(days: number, hours = 10, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function dateDaysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function publicId() {
  return `q_${randomBytes(6).toString("hex")}`;
}

async function findOrCreateUser(admin: SupabaseClient) {
  const created = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: demoPassword,
    email_confirm: true,
    user_metadata: { display_name: "Leadely Demo" },
  });
  if (created.data.user) return created.data.user.id;

  const { data: profile } = await admin.from("profiles").select("id").eq("email", DEMO_EMAIL).maybeSingle();
  if (!profile?.id) {
    throw new Error(created.error?.message || "Could not create or find demo user.");
  }
  const updated = await admin.auth.admin.updateUserById(profile.id, {
    password: demoPassword,
    email_confirm: true,
  });
  if (updated.error) throw new Error(`Reset demo password: ${updated.error.message}`);
  return profile.id;
}

async function findOrCreateWorkspace(admin: SupabaseClient, userId: string) {
  const { data: membership } = await admin.from("workspace_members").select("workspace_id").eq("user_id", userId).maybeSingle();
  if (membership?.workspace_id) {
    await admin.from("workspaces").update({ name: DEMO_WORKSPACE, plan_status: "active", locked: false }).eq("id", membership.workspace_id);
    return membership.workspace_id as string;
  }

  const plans = await must(
    "Load plans",
    admin.from("plans").select("id, name, is_free, trial_days, sort_order").order("sort_order"),
  );
  const plan =
    plans?.find((row) => /pro/i.test(row.name)) ||
    plans?.find((row) => !row.is_free) ||
    plans?.[0];
  if (!plan) throw new Error("No plans found. Seed plans in Supabase first.");

  const workspaceId = crypto.randomUUID();
  await must(
    "Create workspace",
    admin.from("workspaces").insert({
      id: workspaceId,
      type: "company",
      name: DEMO_WORKSPACE,
      slug: slugify(DEMO_WORKSPACE),
      plan_id: plan.id,
      plan_status: "active",
      locked: false,
    }).select("id").single(),
  );
  await must(
    "Add owner",
    admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId, role: "owner" }),
  );
  await admin.from("workspace_settings").insert({
    workspace_id: workspaceId,
    company_name: "CÔNG TY TNHH CAP SAINT JACQUES TEK",
    short_name: "CJTEK",
    tax_code: "0319520814",
    address: "Tầng 1, Số 207A Nguyễn Văn Thủ, Phường Tân Định, TP. Hồ Chí Minh",
    email: DEMO_EMAIL,
    phone: "02873000000",
    website: "https://cjtek.vn",
    logo_path: "/brand/logo.jpg",
    accent_color: "#2FF29E",
    about: "Demo workspace with seeded CRM and quote data.",
    legal_representative: "TRẦN THIÊN PHƯỚC",
    legal_representative_title: "Giám đốc",
    bank_account_name: "CÔNG TY TNHH CAP SAINT JACQUES TEK",
    contract_number_prefix: "HDDV-DEMO",
  });
  const templates = await must("Load module templates", admin.from("module_templates").select("*").order("sort_order"));
  if (templates?.length) {
    await must(
      "Copy modules",
      admin.from("modules").insert(
        templates.map((template) => ({
          workspace_id: workspaceId,
          name: template.name,
          category: template.category,
          description: template.description,
          suggested_price: template.suggested_price,
          default_qty: template.default_qty,
          visual_hint: template.visual_hint,
        })),
      ),
    );
  }
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  await admin.from("subscriptions").insert({
    workspace_id: workspaceId,
    plan_id: plan.id,
    status: "active",
    billing_interval: "monthly",
    current_period_start: new Date().toISOString(),
    current_period_end: periodEnd.toISOString(),
  });
  return workspaceId;
}

async function wipeCrm(admin: SupabaseClient, workspaceId: string) {
  const tables = [
    "sequence_enrollments",
    "sequence_steps",
    "sequences",
    "lead_list_members",
    "lead_lists",
    "lead_scrape_people",
    "lead_scrape_results",
    "lead_scrape_jobs",
    "communications",
    "contracts",
    "tasks",
    "meetings",
    "activities",
    "deal_contacts",
    "quotes",
    "leads",
    "deals",
    "contacts",
    "companies",
    "clients",
  ];
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("workspace_id", workspaceId);
    if (error) throw new Error(`Wipe ${table}: ${error.message}`);
  }
}

async function seedCrm(admin: SupabaseClient, workspaceId: string, userId: string) {
  const stages = await must(
    "Load pipeline stages",
    admin.from("pipeline_stages").select("id, name, stage_type, probability, pipeline_id").eq("workspace_id", workspaceId),
  );
  if (!stages?.length) {
    throw new Error("No pipeline stages. Apply CRM migrations (20260921000000_crm_foundation.sql) first.");
  }
  const stageByName = Object.fromEntries(stages.map((stage: Stage) => [stage.name, stage]));
  const pipelineId = stages[0].pipeline_id;
  const stage = (name: string) => {
    const found = stageByName[name];
    if (!found) throw new Error(`Missing pipeline stage "${name}"`);
    return found;
  };

  const firms = [
    { id: crypto.randomUUID(), name: "Nova Retail", industry: "F&B", email: "hello@novaretail.vn", phone: "02871001001", domain: "novaretail.vn", lifecycle: "active_opportunity", source: "maps" },
    { id: crypto.randomUUID(), name: "Mekong Logistics", industry: "Logistics", email: "bd@mekonglog.vn", phone: "02871001002", domain: "mekonglog.vn", lifecycle: "active_opportunity", source: "referral" },
    { id: crypto.randomUUID(), name: "An Binh Clinic", industry: "Healthcare", email: "admin@anbinhclinic.vn", phone: "02871001003", domain: "anbinhclinic.vn", lifecycle: "prospect", source: "inbound" },
    { id: crypto.randomUUID(), name: "Sài Gòn EdTech", industry: "Education", email: "partnerships@saigonedtech.vn", phone: "02871001004", domain: "saigonedtech.vn", lifecycle: "customer", source: "website" },
    { id: crypto.randomUUID(), name: "Delta Manufacturing", industry: "Manufacturing", email: "it@delta-mfg.vn", phone: "02871001005", domain: "delta-mfg.vn", lifecycle: "prospect", source: "maps" },
    { id: crypto.randomUUID(), name: "Harbor Hospitality", industry: "Hospitality", email: "gm@harborhotel.vn", phone: "02871001006", domain: "harborhotel.vn", lifecycle: "customer", source: "referral" },
    { id: crypto.randomUUID(), name: "Phong Vũ Digital", industry: "Retail", email: "digital@phongvu.vn", phone: "02871001007", domain: "phongvu.vn", lifecycle: "inactive", source: "outbound" },
    { id: crypto.randomUUID(), name: "GreenFarm Market", industry: "Agriculture", email: "ops@greenfarm.vn", phone: "02871001008", domain: "greenfarm.vn", lifecycle: "prospect", source: "maps" },
  ];

  const people = [
    { id: crypto.randomUUID(), company: 0, first: "Lan", last: "Nguyễn", title: "Head of Digital", email: "lan.nguyen@novaretail.vn" },
    { id: crypto.randomUUID(), company: 1, first: "Minh", last: "Trần", title: "COO", email: "minh.tran@mekonglog.vn" },
    { id: crypto.randomUUID(), company: 2, first: "Hạnh", last: "Phạm", title: "Clinic Director", email: "hanh.pham@anbinhclinic.vn" },
    { id: crypto.randomUUID(), company: 3, first: "Khoa", last: "Lê", title: "Founder", email: "khoa.le@saigonedtech.vn" },
    { id: crypto.randomUUID(), company: 4, first: "Quang", last: "Võ", title: "IT Manager", email: "quang.vo@delta-mfg.vn" },
    { id: crypto.randomUUID(), company: 5, first: "My", last: "Đặng", title: "General Manager", email: "my.dang@harborhotel.vn" },
    { id: crypto.randomUUID(), company: 6, first: "Phúc", last: "Hoàng", title: "Marketing Lead", email: "phuc.hoang@phongvu.vn" },
    { id: crypto.randomUUID(), company: 7, first: "Tâm", last: "Bùi", title: "Operations", email: "tam.bui@greenfarm.vn" },
  ];

  await must(
    "Insert companies",
    admin.from("companies").insert(
      firms.map((firm) => ({
        id: firm.id,
        workspace_id: workspaceId,
        name: firm.name,
        domain: firm.domain,
        website: `https://${firm.domain}`,
        industry: firm.industry,
        company_size: "51-200",
        phone: firm.phone,
        email: firm.email,
        address: "TP. Hồ Chí Minh",
        owner_user_id: userId,
        lifecycle_stage: firm.lifecycle,
        lead_source: firm.source,
        notes: "demo-seed",
      })),
    ),
  );

  await must(
    "Insert contacts",
    admin.from("contacts").insert(
      people.map((person) => ({
        id: person.id,
        workspace_id: workspaceId,
        company_id: firms[person.company].id,
        first_name: person.first,
        last_name: person.last,
        display_name: `${person.first} ${person.last}`,
        email: person.email,
        phone: firms[person.company].phone,
        job_title: person.title,
        owner_user_id: userId,
        relationship_strength: "developing",
      })),
    ),
  );

  const clients = firms.slice(0, 6).map((firm, index) => ({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    company_name: firm.name,
    contact_name: `${people[index].first} ${people[index].last}`,
    email: people[index].email,
    phone: firm.phone,
    industry: firm.industry,
    notes: "demo-seed",
  }));
  await must("Insert clients", admin.from("clients").insert(clients));
  for (let index = 0; index < clients.length; index += 1) {
    await admin.from("companies").update({ legacy_client_id: clients[index].id }).eq("id", firms[index].id);
  }

  const leadRows = [
    { company: 0, contact: 0, status: "working", source: "maps" },
    { company: 1, contact: 1, status: "qualified", source: "referral" },
    { company: 2, contact: 2, status: "connected", source: "inbound" },
    { company: 3, contact: 3, status: "qualified", source: "website" },
    { company: 4, contact: 4, status: "new", source: "maps" },
    { company: 5, contact: 5, status: "qualified", source: "referral" },
    { company: 6, contact: 6, status: "unqualified", source: "outbound" },
    { company: 7, contact: 7, status: "working", source: "maps" },
  ];
  const leads = leadRows.map((row) => ({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    company_id: firms[row.company].id,
    contact_id: people[row.contact].id,
    owner_user_id: userId,
    status: row.status,
    source: row.source,
    last_activity_at: isoDaysFromNow(-row.company),
  }));
  await must("Insert leads", admin.from("leads").insert(leads));

  const dealPlan = [
    { key: "nova", company: 0, contact: 0, title: "Nova Retail — POS + loyalty app", stage: "Proposal", amount: 180_000_000, close: 18, lead: 0 },
    { key: "mekong", company: 1, contact: 1, title: "Mekong Logistics — dispatch portal", stage: "Negotiation", amount: 420_000_000, close: 12, lead: 1 },
    { key: "anbinh", company: 2, contact: 2, title: "An Binh Clinic — patient CRM", stage: "Qualified", amount: 95_000_000, close: 25, lead: 2 },
    { key: "edtech", company: 3, contact: 3, title: "Sài Gòn EdTech — LMS rollout", stage: "Won", amount: 260_000_000, close: -20, lead: 3 },
    { key: "delta", company: 4, contact: 4, title: "Delta Manufacturing — internal MES UI", stage: "Contacted", amount: 70_000_000, close: 40, lead: 4 },
    { key: "harbor", company: 5, contact: 5, title: "Harbor Hospitality — booking engine", stage: "Won", amount: 310_000_000, close: -8, lead: 5 },
    { key: "phongvu", company: 6, contact: 6, title: "Phong Vũ — marketplace revamp", stage: "Lost", amount: 150_000_000, close: -5, lead: 6 },
    { key: "green", company: 7, contact: 7, title: "GreenFarm — wholesale marketplace", stage: "Discovery", amount: 210_000_000, close: 30, lead: 7 },
  ];

  const deals = dealPlan.map((row) => {
    const pipe = stage(row.stage);
    return {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      company_id: firms[row.company].id,
      primary_contact_id: people[row.contact].id,
      pipeline_id: pipelineId,
      stage_id: pipe.id,
      owner_user_id: userId,
      title: row.title,
      description: "Seeded demo opportunity.",
      deal_type: "sales",
      amount: row.amount,
      currency: "VND",
      probability: pipe.probability,
      expected_close_date: dateDaysFromNow(row.close),
      priority: row.amount >= 300_000_000 ? "high" : "medium",
      source: firms[row.company].source,
      won_at: pipe.stage_type === "won" ? isoDaysFromNow(row.close) : null,
      lost_at: pipe.stage_type === "lost" ? isoDaysFromNow(row.close) : null,
      lost_reason: pipe.stage_type === "lost" ? "Budget freeze" : null,
    };
  });
  await must("Insert deals", admin.from("deals").insert(deals));

  for (let index = 0; index < dealPlan.length; index += 1) {
    const pipe = stage(dealPlan[index].stage);
    if (pipe.stage_type === "won" || pipe.stage_type === "open") {
      await admin.from("leads").update({ converted_deal_id: deals[index].id, status: pipe.stage_type === "won" ? "qualified" : leads[index].status }).eq("id", leads[index].id);
    }
  }

  await must(
    "Insert deal contacts",
    admin.from("deal_contacts").insert(
      deals.map((deal, index) => ({
        workspace_id: workspaceId,
        deal_id: deal.id,
        contact_id: people[dealPlan[index].contact].id,
        stakeholder_role: "decision_maker",
        influence_level: "high",
        relationship_strength: "developing",
        is_primary: true,
      })),
    ),
  );

  const quoteSpecs = [
    { deal: 0, client: 0, title: "Nova Retail POS quote", status: "sent", v2: "sent" },
    { deal: 1, client: 1, title: "Mekong Logistics portal quote", status: "sent", v2: "sent" },
    { deal: 3, client: 3, title: "Sài Gòn EdTech LMS quote", status: "won", v2: "accepted" },
    { deal: 5, client: 5, title: "Harbor booking engine quote", status: "won", v2: "accepted" },
    { deal: 2, client: 2, title: "An Binh Clinic CRM draft", status: "draft", v2: "draft" },
  ];
  await must(
    "Insert quotes",
    admin.from("quotes").insert(
      quoteSpecs.map((spec) => {
        const deal = deals[spec.deal];
        return {
          workspace_id: workspaceId,
          client_id: clients[spec.client].id,
          deal_id: deal.id,
          public_id: publicId(),
          title: spec.title,
          project_type: "Web App",
          status: spec.status,
          quote_status_v2: spec.v2,
          currency: "VND",
          items: [{ id: crypto.randomUUID(), name: deal.title, description: "Implementation package", qty: 1, unitPrice: deal.amount }],
          deliverables: [{ id: crypto.randomUUID(), name: "MVP release", description: "Production-ready scope", priority: "Cao" }],
          payment_milestones: [
            { id: crypto.randomUUID(), label: "Kickoff", description: "Start", percent: 50, trigger: "Contract signed" },
            { id: crypto.randomUUID(), label: "Handover", description: "Go-live", percent: 50, trigger: "Acceptance" },
          ],
          discount: 0,
          vat_rate: 0,
          project_overview: spec.title,
          timeline: "8–12 weeks",
          next_steps: "Review modules and confirm kickoff date.",
          contract_number: `HDDV-DEMO-${spec.deal + 1}`,
          sent_at: spec.status === "draft" ? null : isoDaysFromNow(-6),
          accepted_at: spec.status === "won" ? isoDaysFromNow(-2) : null,
        };
      }),
    ),
  );

  await must(
    "Insert tasks",
    admin.from("tasks").insert([
      { workspace_id: workspaceId, assigned_to: userId, deal_id: deals[0].id, company_id: firms[0].id, contact_id: people[0].id, type: "follow_up", title: "Follow up Nova Retail proposal", priority: "high", status: "open", due_at: isoDaysFromNow(0, 14, 30), created_by: userId },
      { workspace_id: workspaceId, assigned_to: userId, deal_id: deals[1].id, company_id: firms[1].id, contact_id: people[1].id, type: "call", title: "Call Mekong COO on pricing", priority: "high", status: "open", due_at: isoDaysFromNow(0, 16, 0), created_by: userId },
      { workspace_id: workspaceId, assigned_to: userId, deal_id: deals[7].id, company_id: firms[7].id, type: "review", title: "Prep GreenFarm discovery notes", priority: "medium", status: "open", due_at: isoDaysFromNow(0, 11, 0), created_by: userId },
      { workspace_id: workspaceId, assigned_to: userId, deal_id: deals[2].id, company_id: firms[2].id, type: "email", title: "Send An Binh clinic case study", priority: "medium", status: "open", due_at: isoDaysFromNow(1, 9, 30), created_by: userId },
      { workspace_id: workspaceId, assigned_to: userId, deal_id: deals[4].id, company_id: firms[4].id, type: "review", title: "Review Delta MES scope", priority: "low", status: "open", due_at: isoDaysFromNow(-1, 17, 0), created_by: userId },
    ]),
  );

  await must(
    "Insert meetings",
    admin.from("meetings").insert([
      { workspace_id: workspaceId, title: "Nova Retail proposal walkthrough", starts_at: isoDaysFromNow(0, 10, 0), ends_at: isoDaysFromNow(0, 11, 0), location: "Google Meet", company_id: firms[0].id, contact_id: people[0].id, deal_id: deals[0].id, owner_user_id: userId },
      { workspace_id: workspaceId, title: "Mekong Logistics commercial review", starts_at: isoDaysFromNow(0, 15, 30), ends_at: isoDaysFromNow(0, 16, 30), location: "CJTEK office", company_id: firms[1].id, contact_id: people[1].id, deal_id: deals[1].id, owner_user_id: userId },
      { workspace_id: workspaceId, title: "Harbor Hospitality kickoff", starts_at: isoDaysFromNow(2, 9, 0), ends_at: isoDaysFromNow(2, 10, 0), location: "Harbor Hotel Q1", company_id: firms[5].id, contact_id: people[5].id, deal_id: deals[5].id, owner_user_id: userId },
      { workspace_id: workspaceId, title: "GreenFarm discovery workshop", starts_at: isoDaysFromNow(5, 13, 30), ends_at: isoDaysFromNow(5, 15, 0), location: "Zoom", company_id: firms[7].id, contact_id: people[7].id, deal_id: deals[7].id, owner_user_id: userId },
    ]),
  );

  await must(
    "Insert contracts",
    admin.from("contracts").insert([
      { workspace_id: workspaceId, deal_id: deals[3].id, company_id: firms[3].id, title: "Sài Gòn EdTech LMS contract", status: "signed", notes: "Signed after the LMS quote was accepted.", signed_at: isoDaysFromNow(-2) },
      { workspace_id: workspaceId, deal_id: deals[5].id, company_id: firms[5].id, title: "Harbor booking engine contract", status: "sent", notes: "Waiting on the general manager to countersign." },
      { workspace_id: workspaceId, deal_id: deals[0].id, company_id: firms[0].id, title: "Nova Retail POS contract", status: "draft", notes: "Draft from the POS proposal. Not sent yet." },
    ]),
  );

  await must(
    "Insert communications",
    admin.from("communications").insert([
      { workspace_id: workspaceId, provider: "manual", direction: "outbound", subject: "Nova POS proposal follow-up", body: "Gửi lại phạm vi POS và lịch walkthrough.", from_address: DEMO_EMAIL, to_address: people[0].email, company_id: firms[0].id, contact_id: people[0].id, deal_id: deals[0].id, occurred_at: isoDaysFromNow(-1, 9, 15) },
      { workspace_id: workspaceId, provider: "manual", direction: "inbound", subject: "Re: Mekong pricing", body: "COO hỏi lại SLA và chi phí năm 2.", from_address: people[1].email, to_address: DEMO_EMAIL, company_id: firms[1].id, contact_id: people[1].id, deal_id: deals[1].id, occurred_at: isoDaysFromNow(0, 8, 40) },
      { workspace_id: workspaceId, provider: "manual", direction: "outbound", subject: "An Binh clinic case study", body: "Case study phòng khám để chuẩn bị discovery.", from_address: DEMO_EMAIL, to_address: people[2].email, company_id: firms[2].id, contact_id: people[2].id, deal_id: deals[2].id, occurred_at: isoDaysFromNow(-3, 11, 0) },
      { workspace_id: workspaceId, provider: "manual", direction: "outbound", subject: "Harbor kickoff agenda", body: "Agenda kickoff booking engine tuần sau.", from_address: DEMO_EMAIL, to_address: people[5].email, company_id: firms[5].id, contact_id: people[5].id, deal_id: deals[5].id, occurred_at: isoDaysFromNow(-2, 16, 20) },
    ]),
  );

  const sequences = await must(
    "Insert sequences",
    admin.from("sequences").insert([
      { workspace_id: workspaceId, name: "Retail proposal follow-up", description: "Ba chạm sau khi gửi proposal cho retail.", status: "active", owner_user_id: userId },
      { workspace_id: workspaceId, name: "Clinic discovery nudge", description: "Nhắc lịch discovery cho phòng khám chưa phản hồi.", status: "paused", owner_user_id: userId },
    ]).select("id, name"),
  );
  const retailSequence = sequences?.find((item) => item.name.startsWith("Retail"));
  const clinicSequence = sequences?.find((item) => item.name.startsWith("Clinic"));
  if (!retailSequence || !clinicSequence) throw new Error("Sequence seed did not return ids.");

  await must(
    "Insert sequence steps",
    admin.from("sequence_steps").insert([
      { workspace_id: workspaceId, sequence_id: retailSequence.id, position: 1, step_type: "email", delay_days: 0, subject: "Proposal recap", body: "Tóm tắt phạm vi POS và đề xuất lịch walkthrough." },
      { workspace_id: workspaceId, sequence_id: retailSequence.id, position: 2, step_type: "wait", delay_days: 3, subject: "Wait 3 days", body: "Chờ phản hồi trước khi gọi." },
      { workspace_id: workspaceId, sequence_id: retailSequence.id, position: 3, step_type: "task", delay_days: 3, subject: "Call the buyer", body: "Gọi decision maker nếu email recap chưa được trả lời." },
      { workspace_id: workspaceId, sequence_id: clinicSequence.id, position: 1, step_type: "email", delay_days: 1, subject: "Clinic case study", body: "Gửi case study và đề xuất khung giờ discovery." },
    ]),
  );

  await must(
    "Insert enrollments",
    admin.from("sequence_enrollments").insert([
      { workspace_id: workspaceId, sequence_id: retailSequence.id, company_id: firms[0].id, contact_id: people[0].id, status: "active", current_step: 1 },
      { workspace_id: workspaceId, sequence_id: clinicSequence.id, company_id: firms[2].id, contact_id: people[2].id, status: "paused", current_step: 0 },
    ]),
  );

  const lists = await must(
    "Insert lead lists",
    admin.from("lead_lists").insert([
      { workspace_id: workspaceId, name: "Q3 F&B pipeline", description: "Retail và F&B đang ở proposal hoặc discovery.", source: "manual", status: "active", owner_user_id: userId },
      { workspace_id: workspaceId, name: "Healthcare nurture", description: "Phòng khám cần nurture trước khi qualify.", source: "manual", status: "active", owner_user_id: userId },
    ]).select("id, name"),
  );
  const fnbList = lists?.find((item) => item.name.startsWith("Q3"));
  const healthList = lists?.find((item) => item.name.startsWith("Healthcare"));
  if (!fnbList || !healthList) throw new Error("Lead list seed did not return ids.");

  await must(
    "Insert list members",
    admin.from("lead_list_members").insert([
      { workspace_id: workspaceId, list_id: fnbList.id, company_id: firms[0].id, contact_id: people[0].id, lead_id: leads[0].id, added_from: "crm", status: "proposed" },
      { workspace_id: workspaceId, list_id: fnbList.id, company_id: firms[7].id, contact_id: people[7].id, lead_id: leads[7].id, added_from: "crm", status: "new" },
      { workspace_id: workspaceId, list_id: healthList.id, company_id: firms[2].id, contact_id: people[2].id, lead_id: leads[2].id, added_from: "crm", status: "contacted" },
    ]),
  );

  const jobs = await must(
    "Insert scrape jobs",
    admin.from("lead_scrape_jobs").insert([
      { workspace_id: workspaceId, created_by: userId, query: "quán cà phê specialty", location: "Quận 1, Hồ Chí Minh", language: "vi", max_results: 20, status: "succeeded", apify_actor_id: "demo", webhook_secret: randomBytes(8).toString("hex"), places_found: 2, places_imported: 0, people_found: 1, people_imported: 0, enrich_people: true, max_people_per_place: 3, pdpa_confirmed: true, finished_at: isoDaysFromNow(-1) },
      { workspace_id: workspaceId, created_by: userId, query: "phòng khám đa khoa", location: "Quận 3, Hồ Chí Minh", language: "vi", max_results: 15, status: "running", apify_actor_id: "demo", webhook_secret: randomBytes(8).toString("hex"), places_found: 1, places_imported: 0, people_found: 0, people_imported: 0, enrich_people: true, max_people_per_place: 3, pdpa_confirmed: true, started_at: isoDaysFromNow(0, 9, 0) },
    ]).select("id, query"),
  );
  const cafeJob = jobs?.find((item) => item.query.includes("cà phê"));
  const clinicJob = jobs?.find((item) => item.query.includes("phòng khám"));
  if (!cafeJob || !clinicJob) throw new Error("Scrape job seed did not return ids.");

  const places = await must(
    "Insert scrape results",
    admin.from("lead_scrape_results").insert([
      { workspace_id: workspaceId, job_id: cafeJob.id, name: "The Workshop Coffee", category: "Cafe", address: "27 Ngô Đức Kế", city: "Hồ Chí Minh", phone: "02838221234", website: "https://theworkshop.vn", match_status: "new", selected: true, raw: {} },
      { workspace_id: workspaceId, job_id: cafeJob.id, name: "Cà phê Ông Thọ", category: "Cafe", address: "12 Nguyễn Thiệp", city: "Hồ Chí Minh", phone: "02838229876", website: "https://ongtho.cafe", match_status: "new", selected: false, raw: {} },
      { workspace_id: workspaceId, job_id: clinicJob.id, name: "Phòng khám Đa khoa Ánh Dương", category: "Clinic", address: "88 Võ Văn Tần", city: "Hồ Chí Minh", phone: "02839331234", website: "https://anhduong.clinic", match_status: "new", selected: true, raw: {} },
    ]).select("id, name"),
  );
  const workshop = places?.find((item) => item.name.startsWith("The Workshop"));
  if (!workshop) throw new Error("Scrape result seed did not return ids.");

  await must(
    "Insert scrape people",
    admin.from("lead_scrape_people").insert([
      { workspace_id: workspaceId, result_id: workshop.id, full_name: "Mai Lê", job_title: "Store manager", email: "mai.le@theworkshop.vn", phone: "0903123456", match_status: "new", selected: true, raw: {} },
    ]),
  );
}

async function main() {
  loadEnv();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  demoPassword = requireEnv("DEMO_PASSWORD");
  if (demoPassword.length < 12) throw new Error("DEMO_PASSWORD must contain at least 12 characters.");
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const userId = await findOrCreateUser(admin);
  const workspaceId = await findOrCreateWorkspace(admin, userId);
  await wipeCrm(admin, workspaceId);
  await seedCrm(admin, workspaceId, userId);

  console.log("Demo account ready.");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log("  Password: read from DEMO_PASSWORD (not printed)");
  console.log(`  Workspace: ${DEMO_WORKSPACE} (${workspaceId})`);
  console.log("Log in at /login then open Dashboard.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
