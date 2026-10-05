/**
 * Create (or refresh) the Bizcraw demo account and fill its workspace with CRM + quote mock data.
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
const DEMO_WORKSPACE = "Bizcraw Demo";

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
  const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", DEMO_EMAIL).maybeSingle();
  if (existingProfile?.id) {
    await admin.from("profiles").update({ display_name: "Bizcraw Demo" }).eq("id", existingProfile.id);
    await admin.auth.admin.updateUserById(existingProfile.id, { user_metadata: { display_name: "Bizcraw Demo" } });
    return existingProfile.id;
  }

  demoPassword = requireEnv("DEMO_PASSWORD");
  if (demoPassword.length < 12) throw new Error("DEMO_PASSWORD must contain at least 12 characters.");
  const created = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: demoPassword,
    email_confirm: true,
    user_metadata: { display_name: "Bizcraw Demo" },
  });
  if (created.data.user) return created.data.user.id;

  throw new Error(created.error?.message || "Could not create demo user.");
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
    company_name: "Bizcraw Demo Inc.",
    short_name: "CJTEK",
    tax_code: "0319520814",
    address: "100 Market Street, San Francisco, CA",
    email: DEMO_EMAIL,
    phone: "02873000000",
    website: "https://bizcraw.com",
    logo_path: "/brand/logo.jpg",
    accent_color: "#2FF29E",
    about: "Demo workspace with seeded CRM and quote data.",
    legal_representative: "Alex Morgan",
    legal_representative_title: "Director",
    bank_account_name: "Bizcraw Demo Inc.",
    contract_number_prefix: "DEMO",
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
    { id: crypto.randomUUID(), name: "Northstar Retail", industry: "F&B", email: "hello@northstar.example", phone: "02871001001", domain: "northstar.example", lifecycle: "active_opportunity", source: "maps" },
    { id: crypto.randomUUID(), name: "Atlas Logistics", industry: "Logistics", email: "bd@atlaslogistics.example", phone: "02871001002", domain: "atlaslogistics.example", lifecycle: "active_opportunity", source: "referral" },
    { id: crypto.randomUUID(), name: "BrightCare Health", industry: "Healthcare", email: "admin@brightcare.example", phone: "02871001003", domain: "brightcare.example", lifecycle: "prospect", source: "inbound" },
    { id: crypto.randomUUID(), name: "Summit Learning", industry: "Education", email: "partnerships@summitlearning.example", phone: "02871001004", domain: "summitlearning.example", lifecycle: "customer", source: "website" },
    { id: crypto.randomUUID(), name: "Forge Manufacturing", industry: "Manufacturing", email: "it@forge.example", phone: "02871001005", domain: "forge.example", lifecycle: "prospect", source: "maps" },
    { id: crypto.randomUUID(), name: "Harbor Hotels", industry: "Hospitality", email: "gm@harborhotels.example", phone: "02871001006", domain: "harborhotels.example", lifecycle: "customer", source: "referral" },
    { id: crypto.randomUUID(), name: "Orbit Commerce", industry: "Retail", email: "digital@orbitcommerce.example", phone: "02871001007", domain: "orbitcommerce.example", lifecycle: "inactive", source: "outbound" },
    { id: crypto.randomUUID(), name: "Evergreen Foods", industry: "Agriculture", email: "ops@evergreenfoods.example", phone: "02871001008", domain: "evergreenfoods.example", lifecycle: "prospect", source: "maps" },
  ];

  const people = [
    { id: crypto.randomUUID(), company: 0, first: "Emily", last: "Carter", title: "Head of Digital", email: "lan.nguyen@northstar.example" },
    { id: crypto.randomUUID(), company: 1, first: "Daniel", last: "Brooks", title: "COO", email: "minh.tran@atlaslogistics.example" },
    { id: crypto.randomUUID(), company: 2, first: "Sophia", last: "Lee", title: "Clinic Director", email: "hanh.pham@brightcare.example" },
    { id: crypto.randomUUID(), company: 3, first: "James", last: "Wilson", title: "Founder", email: "khoa.le@summitlearning.example" },
    { id: crypto.randomUUID(), company: 4, first: "Michael", last: "Chen", title: "IT Manager", email: "quang.vo@forge.example" },
    { id: crypto.randomUUID(), company: 5, first: "Olivia", last: "Martin", title: "General Manager", email: "my.dang@harborhotels.example" },
    { id: crypto.randomUUID(), company: 6, first: "Ethan", last: "Walker", title: "Marketing Lead", email: "phuc.hoang@orbitcommerce.example" },
    { id: crypto.randomUUID(), company: 7, first: "Ava", last: "Thompson", title: "Operations", email: "tam.bui@evergreenfoods.example" },
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
        address: "San Francisco, CA",
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
    { key: "nova", company: 0, contact: 0, title: "Northstar Retail — POS + loyalty app", stage: "Proposal", amount: 7_200, close: 18, lead: 0 },
    { key: "mekong", company: 1, contact: 1, title: "Atlas Logistics — dispatch portal", stage: "Negotiation", amount: 16_800, close: 12, lead: 1 },
    { key: "anbinh", company: 2, contact: 2, title: "BrightCare Health — patient CRM", stage: "Qualified", amount: 3_800, close: 25, lead: 2 },
    { key: "edtech", company: 3, contact: 3, title: "Summit Learning — LMS rollout", stage: "Won", amount: 10_400, close: -20, lead: 3 },
    { key: "delta", company: 4, contact: 4, title: "Forge Manufacturing — internal MES UI", stage: "Contacted", amount: 2_800, close: 40, lead: 4 },
    { key: "harbor", company: 5, contact: 5, title: "Harbor Hotels — booking engine", stage: "Won", amount: 12_400, close: -8, lead: 5 },
    { key: "phongvu", company: 6, contact: 6, title: "Orbit Commerce — marketplace revamp", stage: "Lost", amount: 6_000, close: -5, lead: 6 },
    { key: "green", company: 7, contact: 7, title: "GreenFarm — wholesale marketplace", stage: "Discovery", amount: 8_400, close: 30, lead: 7 },
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
      currency: "USD",
      probability: pipe.probability,
      expected_close_date: dateDaysFromNow(row.close),
      priority: row.amount >= 12_000 ? "high" : "medium",
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
    { deal: 0, client: 0, title: "Northstar Retail POS quote", status: "sent", v2: "sent" },
    { deal: 1, client: 1, title: "Atlas Logistics portal quote", status: "sent", v2: "sent" },
    { deal: 3, client: 3, title: "Summit Learning LMS quote", status: "won", v2: "accepted" },
    { deal: 5, client: 5, title: "Harbor booking engine quote", status: "won", v2: "accepted" },
    { deal: 2, client: 2, title: "BrightCare Health CRM draft", status: "draft", v2: "draft" },
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
          currency: "USD",
          items: [{ id: crypto.randomUUID(), name: deal.title, description: "Implementation package", qty: 1, unitPrice: deal.amount }],
          deliverables: [{ id: crypto.randomUUID(), name: "MVP release", description: "Production-ready scope", priority: "High" }],
          payment_milestones: [
            { id: crypto.randomUUID(), label: "Kickoff", description: "Start", percent: 50, trigger: "Contract signed" },
            { id: crypto.randomUUID(), label: "Handover", description: "Go-live", percent: 50, trigger: "Acceptance" },
          ],
          discount: 0,
          vat_rate: 0,
          project_overview: spec.title,
          timeline: "8–12 weeks",
          next_steps: "Review modules and confirm kickoff date.",
          contract_number: `DEMO-${spec.deal + 1}`,
          sent_at: spec.status === "draft" ? null : isoDaysFromNow(-6),
          accepted_at: spec.status === "won" ? isoDaysFromNow(-2) : null,
        };
      }),
    ),
  );

  await must(
    "Insert tasks",
    admin.from("tasks").insert([
      { workspace_id: workspaceId, assigned_to: userId, deal_id: deals[0].id, company_id: firms[0].id, contact_id: people[0].id, type: "follow_up", title: "Follow up Northstar Retail proposal", priority: "high", status: "open", due_at: isoDaysFromNow(0, 14, 30), created_by: userId },
      { workspace_id: workspaceId, assigned_to: userId, deal_id: deals[1].id, company_id: firms[1].id, contact_id: people[1].id, type: "call", title: "Call Atlas COO on pricing", priority: "high", status: "open", due_at: isoDaysFromNow(0, 16, 0), created_by: userId },
      { workspace_id: workspaceId, assigned_to: userId, deal_id: deals[7].id, company_id: firms[7].id, type: "review", title: "Prep GreenFarm discovery notes", priority: "medium", status: "open", due_at: isoDaysFromNow(0, 11, 0), created_by: userId },
      { workspace_id: workspaceId, assigned_to: userId, deal_id: deals[2].id, company_id: firms[2].id, type: "email", title: "Send BrightCare case study", priority: "medium", status: "open", due_at: isoDaysFromNow(1, 9, 30), created_by: userId },
      { workspace_id: workspaceId, assigned_to: userId, deal_id: deals[4].id, company_id: firms[4].id, type: "review", title: "Review Delta MES scope", priority: "low", status: "open", due_at: isoDaysFromNow(-1, 17, 0), created_by: userId },
    ]),
  );

  await must(
    "Insert meetings",
    admin.from("meetings").insert([
      { workspace_id: workspaceId, title: "Northstar Retail proposal walkthrough", starts_at: isoDaysFromNow(0, 10, 0), ends_at: isoDaysFromNow(0, 11, 0), location: "Google Meet", company_id: firms[0].id, contact_id: people[0].id, deal_id: deals[0].id, owner_user_id: userId },
      { workspace_id: workspaceId, title: "Atlas Logistics commercial review", starts_at: isoDaysFromNow(0, 15, 30), ends_at: isoDaysFromNow(0, 16, 30), location: "CJTEK office", company_id: firms[1].id, contact_id: people[1].id, deal_id: deals[1].id, owner_user_id: userId },
      { workspace_id: workspaceId, title: "Harbor Hotels kickoff", starts_at: isoDaysFromNow(2, 9, 0), ends_at: isoDaysFromNow(2, 10, 0), location: "Harbor Hotel Q1", company_id: firms[5].id, contact_id: people[5].id, deal_id: deals[5].id, owner_user_id: userId },
      { workspace_id: workspaceId, title: "GreenFarm discovery workshop", starts_at: isoDaysFromNow(5, 13, 30), ends_at: isoDaysFromNow(5, 15, 0), location: "Zoom", company_id: firms[7].id, contact_id: people[7].id, deal_id: deals[7].id, owner_user_id: userId },
    ]),
  );

  await must(
    "Insert contracts",
    admin.from("contracts").insert([
      { workspace_id: workspaceId, deal_id: deals[3].id, company_id: firms[3].id, title: "Summit Learning LMS contract", status: "signed", notes: "Signed after the LMS quote was accepted.", signed_at: isoDaysFromNow(-2) },
      { workspace_id: workspaceId, deal_id: deals[5].id, company_id: firms[5].id, title: "Harbor booking engine contract", status: "sent", notes: "Waiting on the general manager to countersign." },
      { workspace_id: workspaceId, deal_id: deals[0].id, company_id: firms[0].id, title: "Northstar Retail POS contract", status: "draft", notes: "Draft from the POS proposal. Not sent yet." },
    ]),
  );

  await must(
    "Insert communications",
    admin.from("communications").insert([
      { workspace_id: workspaceId, provider: "manual", direction: "outbound", subject: "Northstar POS proposal follow-up", body: "Resending the POS scope and proposed walkthrough times.", from_address: DEMO_EMAIL, to_address: people[0].email, company_id: firms[0].id, contact_id: people[0].id, deal_id: deals[0].id, occurred_at: isoDaysFromNow(-1, 9, 15) },
      { workspace_id: workspaceId, provider: "manual", direction: "inbound", subject: "Re: Atlas pricing", body: "The COO asked for the SLA and second-year pricing.", from_address: people[1].email, to_address: DEMO_EMAIL, company_id: firms[1].id, contact_id: people[1].id, deal_id: deals[1].id, occurred_at: isoDaysFromNow(0, 8, 40) },
      { workspace_id: workspaceId, provider: "manual", direction: "outbound", subject: "BrightCare case study", body: "Sharing a healthcare case study before discovery.", from_address: DEMO_EMAIL, to_address: people[2].email, company_id: firms[2].id, contact_id: people[2].id, deal_id: deals[2].id, occurred_at: isoDaysFromNow(-3, 11, 0) },
      { workspace_id: workspaceId, provider: "manual", direction: "outbound", subject: "Harbor kickoff agenda", body: "Booking engine kickoff agenda for next week.", from_address: DEMO_EMAIL, to_address: people[5].email, company_id: firms[5].id, contact_id: people[5].id, deal_id: deals[5].id, occurred_at: isoDaysFromNow(-2, 16, 20) },
    ]),
  );

  const sequences = await must(
    "Insert sequences",
    admin.from("sequences").insert([
      { workspace_id: workspaceId, name: "Retail proposal follow-up", description: "Three touches after sending a retail proposal.", status: "active", owner_user_id: userId },
      { workspace_id: workspaceId, name: "Clinic discovery nudge", description: "Nudge healthcare prospects that have not replied.", status: "paused", owner_user_id: userId },
    ]).select("id, name"),
  );
  const retailSequence = sequences?.find((item) => item.name.startsWith("Retail"));
  const clinicSequence = sequences?.find((item) => item.name.startsWith("Clinic"));
  if (!retailSequence || !clinicSequence) throw new Error("Sequence seed did not return ids.");

  await must(
    "Insert sequence steps",
    admin.from("sequence_steps").insert([
      { workspace_id: workspaceId, sequence_id: retailSequence.id, position: 1, step_type: "email", delay_days: 0, subject: "Proposal recap", body: "Summarize the POS scope and propose a walkthrough." },
      { workspace_id: workspaceId, sequence_id: retailSequence.id, position: 2, step_type: "wait", delay_days: 3, subject: "Wait 3 days", body: "Wait for a reply before calling." },
      { workspace_id: workspaceId, sequence_id: retailSequence.id, position: 3, step_type: "task", delay_days: 3, subject: "Call the buyer", body: "Call the decision maker if the recap is unanswered." },
      { workspace_id: workspaceId, sequence_id: clinicSequence.id, position: 1, step_type: "email", delay_days: 1, subject: "Clinic case study", body: "Send a case study and propose discovery times." },
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
      { workspace_id: workspaceId, name: "Q3 F&B pipeline", description: "Retail and hospitality accounts in proposal or discovery.", source: "manual", status: "active", owner_user_id: userId },
      { workspace_id: workspaceId, name: "Healthcare nurture", description: "Healthcare accounts that need nurturing before qualification.", source: "manual", status: "active", owner_user_id: userId },
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
      { workspace_id: workspaceId, created_by: userId, query: "specialty coffee shops", location: "Manhattan, New York", language: "en", max_results: 20, status: "succeeded", apify_actor_id: "demo", webhook_secret: randomBytes(8).toString("hex"), places_found: 2, places_imported: 0, people_found: 1, people_imported: 0, enrich_people: true, max_people_per_place: 3, pdpa_confirmed: true, finished_at: isoDaysFromNow(-1) },
      { workspace_id: workspaceId, created_by: userId, query: "private healthcare clinics", location: "Brooklyn, New York", language: "en", max_results: 15, status: "running", apify_actor_id: "demo", webhook_secret: randomBytes(8).toString("hex"), places_found: 1, places_imported: 0, people_found: 0, people_imported: 0, enrich_people: true, max_people_per_place: 3, pdpa_confirmed: true, started_at: isoDaysFromNow(0, 9, 0) },
    ]).select("id, query"),
  );
  const cafeJob = jobs?.find((item) => item.query.includes("coffee"));
  const clinicJob = jobs?.find((item) => item.query.includes("healthcare"));
  if (!cafeJob || !clinicJob) throw new Error("Scrape job seed did not return ids.");

  const places = await must(
    "Insert scrape results",
    admin.from("lead_scrape_results").insert([
      { workspace_id: workspaceId, job_id: cafeJob.id, name: "Juniper Coffee Roasters", category: "Cafe", address: "27 Spring Street", city: "New York", phone: "02838221234", website: "https://junipercoffee.example", match_status: "new", selected: true, raw: {} },
      { workspace_id: workspaceId, job_id: cafeJob.id, name: "Cedar & Stone Cafe", category: "Cafe", address: "12 Mercer Street", city: "New York", phone: "02838229876", website: "https://cedarstone.example", match_status: "new", selected: false, raw: {} },
      { workspace_id: workspaceId, job_id: clinicJob.id, name: "Brightline Medical Group", category: "Clinic", address: "88 Atlantic Avenue", city: "New York", phone: "02839331234", website: "https://brightline.example", match_status: "new", selected: true, raw: {} },
    ]).select("id, name"),
  );
  const workshop = places?.find((item) => item.name.startsWith("Juniper Coffee"));
  if (!workshop) throw new Error("Scrape result seed did not return ids.");

  await must(
    "Insert scrape people",
    admin.from("lead_scrape_people").insert([
      { workspace_id: workspaceId, result_id: workshop.id, full_name: "Sarah Miller", job_title: "Store manager", email: "sarah.miller@junipercoffee.example", phone: "0903123456", match_status: "new", selected: true, raw: {} },
    ]),
  );
}

async function main() {
  loadEnv();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
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
