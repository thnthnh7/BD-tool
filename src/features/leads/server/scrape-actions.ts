"use server";

import { after } from "next/server";
import type { Json } from "@/lib/database.types";
import { revalidatePath } from "next/cache";
import { requireOwnerOrAdmin } from "@/lib/auth/session";
import { contactDisplayName, formInt, formOptionalId, formText } from "@/lib/crm";
import { recordActivity, withWorkspace } from "@/lib/events";
import { incrementUsage } from "@/lib/usage";
import { buildActorInput, readableActorFields, unsupportedActorFields } from "@/features/leads/actor-input";
import { isMapsActor, MAPS_SLUG } from "@/features/leads/maps-source";
import { claimScrapeIngest, fetchApifyRun, runScrapeIngest, startApifyActorRun, startApifyMapsRun } from "@/features/leads/server/apify";
import { readAllPages } from "@/features/leads/server/read-pages";
import { isPlatformFlagEnabled } from "@/lib/platform/flags";
import { scrapePlaceMatches } from "@/features/leads/scrape-match";
import { getApifyConnectionToken, requireWorkspaceApifyConnection } from "@/features/leads/server/apify-connection";

function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || "http://localhost:3000";
  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

export async function listScrapeJobs() {
  const { context, supabase } = await withWorkspace();
  const jobs = await readAllPages((from, to) => supabase
    .from("lead_scrape_jobs")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .order("created_at", { ascending: false }).order("id")
    .range(from, to));
  const creatorIds = [...new Set(jobs.map((job) => job.created_by).filter((id): id is string => Boolean(id)))];
  const { data: creators } = creatorIds.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", creatorIds)
    : { data: [] };
  const creatorById = new Map((creators || []).map((creator) => [creator.id, creator]));
  return jobs.map((job) => ({ ...job, creator: job.created_by ? creatorById.get(job.created_by) || null : null }));
}

export async function getScrapeJobSummary() {
  const { context, supabase } = await withWorkspace();
  const [all, active] = await Promise.all([
    supabase.from("lead_scrape_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId),
    supabase.from("lead_scrape_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId).in("status", ["queued", "running", "ingesting"]),
  ]);
  if (all.error) throw new Error(all.error.message);
  if (active.error) throw new Error(active.error.message);
  return { total: all.count || 0, active: active.count || 0 };
}

export async function getScrapeJob(id: string) {
  const { context, supabase } = await withWorkspace();
  const { data: job, error: jobError } = await supabase
    .from("lead_scrape_jobs")
    .select("*")
    .eq("workspace_id", context.workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (jobError) throw new Error(jobError.message);
  if (!job) return null;
  const { data: creator } = job.created_by
    ? await supabase.from("profiles").select("id, display_name, email").eq("id", job.created_by).maybeSingle()
    : { data: null };
  const results = await readAllPages((from, to) => supabase
    .from("lead_scrape_results")
    .select("*")
    .eq("job_id", id)
    .eq("workspace_id", context.workspaceId)
    .order("created_at").order("id").range(from, to));
  const resultIds = results.map((row) => row.id);
  const people: import("@/lib/database.types").Database["public"]["Tables"]["lead_scrape_people"]["Row"][] = [];
  for (let index = 0; index < resultIds.length; index += 100) {
    people.push(...await readAllPages((from, to) => supabase.from("lead_scrape_people").select("*")
      .eq("workspace_id", context.workspaceId).in("result_id", resultIds.slice(index, index + 100)).order("id").range(from, to)));
  }
  return { job: { ...job, creator }, results, people };
}

export async function startMapsScrapeAction(formData: FormData) {
  if (!(await isPlatformFlagEnabled("scrape_enabled"))) {
    return { error: "Maps scrape đang tạm dừng." };
  }
  const { context, supabase } = await withWorkspace();
  let apify;
  try { apify = await requireWorkspaceApifyConnection(context.workspaceId); }
  catch (error) { return { error: error instanceof Error ? error.message : "Workspace chưa kết nối Apify." }; }
  if (!context.plan.features.lead_scrape) {
    return { error: "Gói hiện tại không gồm Maps scrape." };
  }
  if (formText(formData, "pdpa_confirmed") !== "on") {
    return { error: "Cần xác nhận sử dụng liên hệ doanh nghiệp hợp lệ (PDPA)." };
  }
  const query = formText(formData, "query");
  const location = formText(formData, "location");
  if (!query || !location) return { error: "Cần từ khóa và khu vực." };

  const { data: source } = await supabase
    .from("scrape_sources")
    .select("id, adapter_status, archived_at")
    .eq("slug", MAPS_SLUG)
    .maybeSingle();
  if (!source || source.archived_at || source.adapter_status !== "ready") {
    return { error: "Google Maps chưa sẵn sàng trong catalog." };
  }
  const { data: installed } = await supabase
    .from("workspace_scrape_sources")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("source_id", source.id)
    .maybeSingle();
  if (!installed) return { error: "Hãy cài Google Maps trong Nguồn dữ liệu." };

  const enrichPeople = formText(formData, "enrich_people") === "on";
  const { data: job, error } = await supabase
    .from("lead_scrape_jobs")
    .insert({
      workspace_id: context.workspaceId,
      created_by: context.userId,
      source_id: source.id,
      apify_actor_id: MAPS_SLUG,
      apify_connection_id: apify.connection.id,
      apify_account_id: apify.connection.apify_user_id,
      apify_account_username: apify.connection.apify_username,
      query,
      location,
      language: formText(formData, "language") || "vi",
      max_results: Math.min(50, Math.max(1, formInt(formData, "max_results", 20))),
      status: "queued",
      enrich_people: enrichPeople,
      max_people_per_place: Math.min(5, Math.max(0, formInt(formData, "max_people_per_place", 5))),
      verify_emails: formText(formData, "verify_emails") === "on",
      pdpa_confirmed: true,
    })
    .select("*")
    .single();
  if (error?.code === "23505") {
    return { error: "Workspace đang có một lượt scrape chưa xong." };
  }
  if (error || !job) return { error: error?.message || "Không tạo được job." };

  const quota = await incrementUsage(
    supabase,
    context.workspaceId,
    "maps_scrapes",
    1,
    -1,
  );
  if (quota.error) {
    await supabase.from("lead_scrape_jobs").delete().eq("id", job.id).eq("workspace_id", context.workspaceId);
    return quota;
  }

  try {
    const webhookUrl = `${siteUrl()}/api/integrations/apify/webhook?jobId=${job.id}&secret=${job.webhook_secret}`;
    const run = await startApifyMapsRun({
      jobId: job.id,
      query: job.query,
      location: job.location,
      language: job.language,
      maxResults: job.max_results,
      enrichPeople: job.enrich_people,
      maxPeoplePerPlace: job.max_people_per_place,
      verifyEmails: job.verify_emails,
      webhookUrl,
      token: apify.token,
    });
    await supabase
      .from("lead_scrape_jobs")
      .update({
        status: "running",
        apify_run_id: run.runId,
        apify_dataset_id: run.datasetId,
        started_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không start được Apify.";
    await supabase.from("lead_scrape_jobs").update({ status: "failed", error_message: message }).eq("id", job.id);
    return { error: message, id: job.id };
  }

  revalidatePath("/app/leads/scrape");
  return { ok: true as const, id: job.id };
}

export async function startActorScrapeAction(formData: FormData) {
  if (!(await isPlatformFlagEnabled("scrape_enabled"))) {
    return { error: "Scrape đang tạm dừng." };
  }
  const { context, supabase } = await withWorkspace();
  let apify;
  try { apify = await requireWorkspaceApifyConnection(context.workspaceId); }
  catch (error) { return { error: error instanceof Error ? error.message : "Workspace chưa kết nối Apify." }; }
  if (!context.plan.features.lead_scrape) return { error: "Gói hiện tại không gồm lead scrape." };
  if (formText(formData, "run_confirmed") !== "on") return { error: "Cần xác nhận được phép chạy actor này." };
  const sourceId = formText(formData, "source_id");
  const { data: source } = await supabase
    .from("scrape_sources")
    .select("id, slug, title, archived_at, input_schema, example_input, schema_fetched_at")
    .eq("id", sourceId)
    .maybeSingle();
  if (!source || source.archived_at || !source.schema_fetched_at || !source.input_schema) {
    return { error: "Nguồn này chưa có form từ Apify." };
  }
  if (isMapsActor(source.slug)) return { error: "Google Maps dùng form riêng." };
  const { data: installed } = await supabase
    .from("workspace_scrape_sources")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("source_id", source.id)
    .maybeSingle();
  if (!installed) return { error: "Hãy cài nguồn này trước." };

  const unsupportedRequired = unsupportedActorFields(source.input_schema).filter((field) => field.required);
  if (unsupportedRequired.length) {
    return { error: `Actor này có trường bắt buộc chưa được hỗ trợ: ${unsupportedRequired.map((field) => field.label).join(", ")}.` };
  }
  const fields = readableActorFields(source.input_schema, source.example_input);
  if (!fields.length) return { error: "Input schema của actor không có trường nào chạy được." };
  const values = Object.fromEntries(fields.map((field) => [field.name, formText(formData, `in_${field.name}`)]));
  for (const field of fields) {
    if (field.kind === "boolean") values[field.name] = formData.get(`in_${field.name}`) === "on" ? "on" : "";
  }
  const built = buildActorInput(fields, values);
  if ("error" in built) return { error: built.error };

  const { data: job, error } = await supabase
    .from("lead_scrape_jobs")
    .insert({
      workspace_id: context.workspaceId,
      created_by: context.userId,
      source_id: source.id,
      apify_actor_id: source.slug,
      apify_connection_id: apify.connection.id,
      apify_account_id: apify.connection.apify_user_id,
      apify_account_username: apify.connection.apify_username,
      query: built.summary || source.title,
      location: "",
      language: "vi",
      max_results: 20,
      filters: built.body as Json,
      status: "queued",
      pdpa_confirmed: true,
    })
    .select("*")
    .single();
  if (error?.code === "23505") return { error: "Workspace đang có một lượt scrape chưa xong." };
  if (error || !job) return { error: error?.message || "Không tạo được job." };

  const quota = await incrementUsage(supabase, context.workspaceId, "maps_scrapes", 1, -1);
  if (quota.error) {
    await supabase.from("lead_scrape_jobs").delete().eq("id", job.id).eq("workspace_id", context.workspaceId);
    return quota;
  }

  try {
    const webhookUrl = `${siteUrl()}/api/integrations/apify/webhook?jobId=${job.id}&secret=${job.webhook_secret}`;
    const run = await startApifyActorRun({ actorSlug: source.slug, body: built.body, webhookUrl, token: apify.token });
    await supabase
      .from("lead_scrape_jobs")
      .update({
        status: "running",
        apify_run_id: run.runId,
        apify_dataset_id: run.datasetId,
        started_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không start được Apify.";
    await supabase.from("lead_scrape_jobs").update({ status: "failed", error_message: message }).eq("id", job.id);
    return { error: message, id: job.id };
  }

  revalidatePath("/app/leads/scrape");
  return { ok: true as const, id: job.id };
}

export async function refreshScrapeJobAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const id = formText(formData, "job_id");
  const { data: job } = await supabase
    .from("lead_scrape_jobs")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (!job?.apify_dataset_id) return { error: "Job chưa có dataset." };
  if (job.status === "ingesting") return { error: "Job đang được xử lý." };
  const generic = Boolean(job.source_id) && !isMapsActor(job.apify_actor_id);
  if (job.status === "succeeded" && !generic && job.apify_usage_usd != null) return { ok: true as const };
  // A refresh must not mark an actor that is still running as successfully ingested.
  if (job.apify_run_id) {
    try {
      if (!job.apify_connection_id) return { error: "Job không có kết nối Apify." };
      const token = await getApifyConnectionToken(job.apify_connection_id);
      const run = await fetchApifyRun(job.apify_run_id, token);
      if (run.usageTotalUsd != null) {
        await supabase.from("lead_scrape_jobs").update({ apify_usage_usd: run.usageTotalUsd }).eq("id", job.id).eq("workspace_id", context.workspaceId);
      }
      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
        const message = `Apify: ${run.status}`;
        await supabase.from("lead_scrape_jobs").update({ status: "failed", error_message: message, finished_at: new Date().toISOString() }).eq("id", job.id).eq("workspace_id", context.workspaceId).in("status", ["queued", "running", "failed"]);
        revalidatePath(`/app/leads/scrape/${id}`);
        return { error: message };
      }
      if (run.status !== "SUCCEEDED") return { error: "Actor vẫn đang chạy. Hãy đồng bộ lại khi actor hoàn tất." };
      if (job.status === "succeeded" && !generic) {
        revalidatePath(`/app/leads/scrape/${id}`);
        revalidatePath("/app/leads/scrape");
        return { ok: true as const };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Không đọc được trạng thái Apify." };
    }
  }

  const claimed = await claimScrapeIngest(supabase, {
    jobId: job.id,
    workspaceId: context.workspaceId,
    datasetId: job.apify_dataset_id,
    runId: job.apify_run_id,
    fromStatuses: generic ? ["queued", "running", "failed", "succeeded"] : ["queued", "running", "failed"],
  });
  if (claimed.error) return { error: claimed.error };
  if (!claimed.job) return { error: "Không nhận được job để xử lý." };

  const claimedJob = claimed.job;
  after(async () => {
    await runScrapeIngest(claimedJob);
  });
  revalidatePath(`/app/leads/scrape/${id}`);
  return { ok: true as const, status: "ingesting" as const };
}

export async function toggleScrapeSelectionAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const resultId = formOptionalId(formData, "result_id");
  const personId = formOptionalId(formData, "person_id");
  const selected = formText(formData, "selected") === "true";
  if (resultId) {
    await supabase
      .from("lead_scrape_results")
      .update({ selected })
      .eq("id", resultId)
      .eq("workspace_id", context.workspaceId);
  }
  if (personId) {
    await supabase
      .from("lead_scrape_people")
      .update({ selected })
      .eq("id", personId)
      .eq("workspace_id", context.workspaceId);
  }
  revalidatePath("/app/leads/scrape", "layout");
  return { ok: true as const };
}

export async function setScrapeBulkSelectionAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const jobId = formText(formData, "job_id");
  const target = formText(formData, "target");
  const selected = formText(formData, "selected") === "true";
  const query = formText(formData, "q");
  if (!jobId || (target !== "places" && target !== "people")) return { error: "Thiếu phạm vi chọn." };

  const { data: job } = await supabase
    .from("lead_scrape_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("workspace_id", context.workspaceId)
    .maybeSingle();
  if (!job) return { error: "Không thấy job." };

  const { data: results } = await supabase
    .from("lead_scrape_results")
    .select("id, name, address, city, category, website, phone, match_status")
    .eq("job_id", jobId)
    .eq("workspace_id", context.workspaceId);
  const resultIds = (results || []).map((row) => row.id);
  type PersonPick = { id: string; result_id: string; full_name: string | null; job_title: string | null; email: string | null; linkedin_url: string | null };
  const { data: people } = resultIds.length
    ? await supabase.from("lead_scrape_people").select("id, result_id, full_name, job_title, email, linkedin_url").in("result_id", resultIds)
    : { data: [] as PersonPick[] };
  const peopleByResult = new Map<string, PersonPick[]>();
  for (const person of people || []) {
    const current = peopleByResult.get(person.result_id) || [];
    current.push(person);
    peopleByResult.set(person.result_id, current);
  }
  const eligibleIds = (results || [])
    .filter((result) => result.match_status !== "imported" && scrapePlaceMatches(query, result, peopleByResult.get(result.id) || []))
    .map((result) => result.id);
  if (!eligibleIds.length) return { ok: true as const };

  if (target === "places") {
    const { error } = await supabase.from("lead_scrape_results").update({ selected }).in("id", eligibleIds).eq("workspace_id", context.workspaceId);
    if (error) return { error: error.message };
  } else {
    const personIds = (people || []).filter((person) => eligibleIds.includes(person.result_id)).map((person) => person.id);
    if (personIds.length) {
      const { error } = await supabase.from("lead_scrape_people").update({ selected }).in("id", personIds).eq("workspace_id", context.workspaceId);
      if (error) return { error: error.message };
    }
  }
  revalidatePath("/app/leads/scrape", "layout");
  return { ok: true as const };
}

export async function importScrapeResultsAction(formData: FormData) {
  const { context, supabase } = await withWorkspace();
  const jobId = formText(formData, "job_id");
  const listId = formOptionalId(formData, "list_id");
  const listName = formText(formData, "list_name");
  const { data: results } = await supabase
    .from("lead_scrape_results")
    .select("*")
    .eq("job_id", jobId)
    .eq("workspace_id", context.workspaceId)
    .eq("selected", true);
  if (!results?.length) return { error: "Chưa chọn place nào." };

  let targetListId = listId;
  if (!targetListId && listName) {
    const { data: list } = await supabase
      .from("lead_lists")
      .insert({
        workspace_id: context.workspaceId,
        name: listName,
        source: "scrape",
        scrape_job_id: jobId,
        owner_user_id: context.userId,
        status: "active",
      })
      .select("id")
      .single();
    targetListId = list?.id || null;
  }

  let importedPlaces = 0;
  let importedPeople = 0;
  for (const result of results) {
    if (result.match_status === "imported") continue;
    let companyId = result.matched_company_id;
    if (!companyId) {
      const domain = (result.website || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || "";
      const { data: company, error } = await supabase
        .from("companies")
        .insert({
          workspace_id: context.workspaceId,
          name: result.name,
          domain,
          website: result.website || "",
          industry: result.category || "",
          phone: result.phone || "",
          email: result.email || "",
          address: result.address || "",
          owner_user_id: context.userId,
          lifecycle_stage: "prospect",
          lead_source: "google_maps",
          external_place_id: result.google_place_id,
        })
        .select("id")
        .single();
      if (error || !company) continue;
      companyId = company.id;
      await recordActivity({
        workspaceId: context.workspaceId,
        actorUserId: context.userId,
        companyId,
        activityType: "note",
        title: `Imported company ${result.name} from Maps`,
      });
    }

    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("workspace_id", context.workspaceId)
      .eq("company_id", companyId)
      .eq("source", "google_maps")
      .maybeSingle();
    let leadId = existingLead?.id || result.matched_lead_id;
    if (!leadId) {
      const { data: lead } = await supabase
        .from("leads")
        .insert({
          workspace_id: context.workspaceId,
          company_id: companyId,
          owner_user_id: context.userId,
          status: "new",
          source: "google_maps",
        })
        .select("id")
        .single();
      leadId = lead?.id || null;
      if (leadId) {
        await recordActivity({
          workspaceId: context.workspaceId,
          actorUserId: context.userId,
          companyId,
          leadId,
          activityType: "lead_created",
          title: `Lead created from Maps · ${result.name}`,
        });
      }
    }

    const { data: people } = await supabase
      .from("lead_scrape_people")
      .select("*")
      .eq("result_id", result.id)
      .eq("selected", true);
    let primaryContactId: string | null = null;
    for (const person of people || []) {
      if (person.match_status === "imported" && person.matched_contact_id) {
        primaryContactId = primaryContactId || person.matched_contact_id;
        continue;
      }
      const display = contactDisplayName(person.first_name || "", person.last_name || "", person.full_name || "");
      const { data: contact } = person.matched_contact_id
        ? await supabase.from("contacts").select("id").eq("id", person.matched_contact_id).maybeSingle()
        : await supabase
            .from("contacts")
            .insert({
              workspace_id: context.workspaceId,
              company_id: companyId,
              first_name: person.first_name || "",
              last_name: person.last_name || "",
              display_name: display,
              email: person.email || "",
              phone: person.phone || "",
              job_title: person.job_title || "",
              linkedin_url: person.linkedin_url || "",
              owner_user_id: context.userId,
            })
            .select("id")
            .single();
      if (!contact) continue;
      await supabase
        .from("lead_scrape_people")
        .update({ match_status: "imported", matched_contact_id: contact.id, imported_at: new Date().toISOString() })
        .eq("id", person.id);
      importedPeople += 1;
      if (!primaryContactId || person.email) primaryContactId = contact.id;
    }

    if (leadId && primaryContactId) {
      await supabase.from("leads").update({ contact_id: primaryContactId }).eq("id", leadId);
    }
    if (targetListId && companyId) {
      await supabase.from("lead_list_members").upsert(
        {
          workspace_id: context.workspaceId,
          list_id: targetListId,
          company_id: companyId,
          lead_id: leadId,
          contact_id: primaryContactId,
          added_from: "scrape",
        },
        { onConflict: "list_id,company_id" },
      );
    }
    await supabase
      .from("lead_scrape_results")
      .update({
        match_status: "imported",
        matched_company_id: companyId,
        matched_lead_id: leadId,
        imported_at: new Date().toISOString(),
      })
      .eq("id", result.id);
    importedPlaces += 1;
  }

  await supabase
    .from("lead_scrape_jobs")
    .update({
      places_imported: importedPlaces,
      people_imported: importedPeople,
    })
    .eq("id", jobId);

  revalidatePath("/app/leads");
  revalidatePath("/app/companies");
  revalidatePath("/app/lists");
  revalidatePath(`/app/leads/scrape/${jobId}`);
  return { ok: true as const, id: targetListId || undefined };
}

export async function requireScrapeAdmin() {
  return requireOwnerOrAdmin();
}
