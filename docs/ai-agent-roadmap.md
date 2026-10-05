# Bizcraw AI Agent Roadmap

## Objective

Build a workspace AI Agent that can answer questions from current workspace data, analyze business activity, execute authorized CRM work, and manage long-running workflows from a persistent chat box across `/app`.

The Agent must use scoped tools to retrieve only the data needed for each request. It must not load an entire workspace database into the model context.

## Product principles

- The Agent inherits the current user's workspace and permissions.
- Facts from the database and AI-generated assessments must be clearly separated.
- Read-only requests can run immediately.
- Data mutations must show a preview appropriate to their risk.
- Bulk, paid, destructive, or externally visible actions require explicit confirmation.
- Every mutation must be idempotent and auditable.
- Ambiguous entity names must be resolved before an action runs.
- Every useful answer should link back to the relevant Bizcraw record.
- The Agent must answer in the user's selected application language unless the user asks otherwise.
- The Agent must degrade safely when a provider, tool, or data source is unavailable.

## Scope boundaries

### Included

- Conversational access to workspace data.
- Workspace analytics and grounded recommendations.
- Authorized CRM, sales, quote, task, scrape, and synchronization operations.
- CSV/XLSX import workflows.
- Persistent conversations, attachments, approvals, audit, and background execution.

### Excluded from the first beta

- Autonomous outbound communication without confirmation.
- Fully autonomous record deletion.
- Training foundation models on customer workspace data.
- Cross-workspace answers or cross-tenant memory.
- Unrestricted execution of arbitrary SQL, JavaScript, shell commands, or external URLs.
- Acting through third-party platforms that have not been connected and authorized.

## User roles and primary use cases

### Workspace owner and admin

- Ask questions across the workspace.
- Review pipeline and team performance.
- Configure Agent availability and limits.
- Approve paid, bulk, destructive, and external actions.
- Review audit history and failed jobs.

### Workspace member

- Ask questions within their granted data scope.
- Create and update records allowed by their role.
- Run personal productivity actions.
- Request elevated actions for owner/admin approval.

### Super Admin

- Enable or disable the Agent platform-wide or by workspace.
- Configure the platform fallback model and provider.
- Inspect operational health without reading customer conversation content by default.
- Review redacted usage, cost, latency, and error metrics.
- Suspend Agent access for abuse or incidents.

## Phase 1: Global chat foundation

- Replace the dashboard-only Quick actions panel with an AI Agent launcher fixed to the bottom-right corner.
- Make the chat available throughout `/app`.
- Support collapsed, expanded, and optional full-screen states.
- Preserve the current conversation while navigating between pages.
- Add prompt suggestions for common workspace tasks.
- Add file attachments.
- Stream assistant responses.
- Show thinking, tool execution, progress, success, and failure states without exposing private reasoning.
- Allow users to cancel a response or long-running operation.
- Persist conversations, messages, tool calls, results, user ID, and workspace ID.
- Add conversation history, rename, archive, and start-new-chat controls.
- Add unread and completed-job indicators.
- Add keyboard navigation, focus management, screen-reader labels, and reduced-motion behavior.
- Support desktop, tablet, and mobile layouts.
- Localize all UI labels, confirmations, errors, dates, and numbers across the application's supported languages.
- Pass safe page context to the Agent:
  - Current route
  - Entity type
  - Entity ID
  - Workspace ID from the authenticated server session

### Phase 1 completion criteria

- Chat works from every authenticated application page.
- Refreshing or navigating does not lose the conversation.
- The Agent understands references such as “this deal” when the current page provides an entity ID.
- No write operation is enabled yet.
- Accessibility and responsive-layout checks pass.

## Conversation and memory model

- Store short-term context inside each conversation.
- Summarize older messages when the context window becomes large.
- Store structured references to entities rather than repeatedly copying full records into messages.
- Do not create cross-conversation long-term memory in the first beta.
- Later, allow explicit user-controlled memory for preferences such as preferred currency, report format, or default pipeline.
- Let users inspect and delete saved memories.
- Never store secrets, credentials, private keys, payment data, or raw authentication tokens in memory.
- Ensure archived or deleted conversations follow the configured retention policy.

## Agent response contract

Every response should be able to contain structured blocks:

- Plain-language answer
- Source records and timestamps
- Fact versus AI assessment labels
- Record links
- Clarifying question
- Proposed action preview
- Confirmation request
- Tool progress
- Completed result
- Partial success and row-level errors
- Retry or recovery action

The UI must not expose hidden chain-of-thought. It may show concise status messages such as “Searching deals” or “Checking quote engagement”.

## Phase 2: Read-only workspace Agent

### Core entity tools

- `search_companies`
- `get_company_360`
- `search_contacts`
- `get_contact_360`
- `search_leads`
- `get_lead`
- `search_deals`
- `get_deal_360`
- `search_quotes`
- `get_quote_status`
- `get_quote_engagement`
- `search_tasks`
- `get_task`
- `get_recent_activity`
- `search_data_library`
- `search_knowledge`
- `get_crm_sync_status`
- `get_scrape_status`
- `get_current_user_and_permissions`
- `get_workspace_schema_capabilities`

### Company 360

Return the company's profile and its related:

- Contacts
- Leads
- Deals
- Quotes
- Tasks
- Activities
- Lead lists
- Last activity date
- Open work and overdue work

### Deal 360

Return:

- Company and primary contact
- Pipeline and stage
- Owner and stakeholders
- Amount, currency, probability, priority, and expected close date
- Recent activities
- Open, overdue, completed, and canceled tasks
- Quotes and the latest quote revision
- Quote engagement events
- Won/lost state and reason where available

### Quote status and engagement

Support factual answers about:

- Draft, sent, accepted, and rejected status
- Sent timestamp
- Current and superseded revisions
- Link opened
- Section viewed
- PDF downloaded
- Accepted or rejected events
- Valid-until date and expiration

Use precise language. If no `opened` event exists, say “No view has been recorded” rather than claiming that the customer definitely has not viewed it.

### Task status

Return:

- Status
- Assignee
- Type and priority
- Due date
- Overdue duration
- Linked company, contact, and deal
- Completion timestamp

### Phase 2 completion criteria

- The Agent answers questions about Company, Contact, Lead, Deal, Quote, and Task data using live workspace data.
- Every query is scoped to the authenticated workspace.
- Answers distinguish database facts from AI assessments.
- Answers include the relevant record link and data timestamp.
- The Agent does not invent missing records or statuses.
- Retrieval tests prove that records from another workspace cannot appear.
- Unsupported questions receive an explicit limitation instead of a fabricated answer.

## Phase 3: Entity resolution and context handling

- Implement exact, normalized, and fuzzy name matching.
- Detect duplicate company, contact, deal, quote, and task names.
- Ask the user to choose when multiple results are plausible.
- Suggest close matches when there is no exact result.
- Resolve “this company”, “this deal”, “this quote”, and similar phrases from the current page context.
- Resolve relative dates using the user's locale and timezone.
- Default to the latest active quote revision where appropriate and explicitly state which revision was selected.
- Never silently infer required mutation fields.
- Preserve selected entities across follow-up messages in the same conversation.
- Invalidate stale entity context when the record is deleted or access is revoked.
- Handle renamed records and superseded quote revisions.

### Phase 3 completion criteria

- Ambiguous requests do not execute against an arbitrary record.
- Context references work consistently across supported entity pages.
- Date interpretation is shown before any time-sensitive mutation.

## Phase 4: Workspace analytics

Create server-side aggregate tools rather than sending raw record collections to the model:

- `get_pipeline_summary`
- `get_quote_conversion`
- `get_overdue_work`
- `get_stale_deals`
- `get_team_workload`
- `get_lead_source_performance`
- `get_sales_activity_summary`
- `get_unviewed_sent_quotes`
- `get_monthly_forecast`

Support questions such as:

- How many deals are open?
- What is the current pipeline value?
- Which sent quotes have no recorded view?
- Which tasks are overdue?
- Which team member has the largest open workload?
- Which deals have had no activity for 14 days?
- What is the quote acceptance rate this month?
- Which lead sources produced the most deals?

### Phase 4 completion criteria

- Aggregations are calculated by the backend and not by the language model.
- Pagination and date boundaries are explicit.
- Currency totals are not combined without a documented conversion rule.
- Timezone, locale, date range, and data freshness are shown.
- Metric definitions are versioned so dashboard and Agent calculations remain consistent.

## Retrieval architecture

- Use deterministic database queries for structured CRM data.
- Use hybrid semantic and keyword retrieval only for unstructured knowledge and documents.
- Keep tool result schemas small, typed, paginated, and stable.
- Return record IDs and canonical URLs with every entity result.
- Apply server-side limits and require narrower filters before returning large datasets.
- Use read replicas or safe caches only where data freshness requirements allow.
- Invalidate cached entity summaries when related data changes.
- Add query timeouts and explain when a partial result was returned.
- Do not let the model generate or execute arbitrary SQL.

## Phase 5: Internal action registry

Extract reusable domain operations from the MCP implementation into an internal tool registry shared by MCP and the in-app Agent.

Initial write tools:

- Create and update companies.
- Create and update contacts.
- Create and update leads.
- Create and update deals.
- Create, update, complete, and cancel tasks.
- Create lists and add records to lists.
- Create quote drafts.
- Add notes and activities.
- Start approved scrapes.
- Start approved CRM synchronizations.

Requirements:

- Validate all inputs with explicit schemas.
- Check entity ownership and workspace relationships on the server.
- Use idempotency keys for every write.
- Record the requesting user, conversation, tool, arguments, result, and affected record IDs.
- Return links to created or updated records.
- Reuse one domain implementation across UI forms, Agent tools, and MCP where practical.
- Version tool schemas and preserve backward compatibility during deployments.
- Define compensating operations for tools that support undo.
- Add dry-run support for bulk or complex tools.
- Prevent the model from supplying actor IDs, workspace IDs, permission scopes, or billing identities.

## Phase 6: Confirmation and risk model

### Tier 1: Execute immediately

- Search and read operations
- Summaries and analytics
- Navigation suggestions

### Tier 2: Preview and confirm

- Create a company, contact, lead, deal, task, list, or quote draft
- Update non-destructive record fields
- Complete a task

Confirmation cards must show the exact record and fields that will change.

### Tier 3: Strong confirmation

- Bulk import
- Delete or archive operations
- Send email or quote
- Start paid scraping
- Start CRM synchronization
- Export large or sensitive datasets
- Change ownership or permissions

Strong confirmation must explain cost, record count, external effects, and whether the action can be undone.

### Approval lifecycle

- Proposed
- Waiting for confirmation
- Approved
- Running
- Completed
- Partially completed
- Failed
- Canceled
- Expired

Approvals must expire, bind to an exact tool payload hash, and become invalid if the proposed data changes.

## Phase 7: CSV and XLSX import Agent

- Accept CSV and XLSX files.
- Detect file type, encoding, sheet names, headers, and row count.
- Infer mappings for name, email, phone, company, job title, LinkedIn URL, notes, and owner.
- Allow users to edit field mappings.
- Validate required fields, email addresses, URLs, data lengths, and unsupported values.
- Preview sample rows before import.
- Detect duplicates by configured matching rules.
- Allow per-import duplicate policies:
  - Skip
  - Update existing
  - Create a new record
- Support creation of missing companies where authorized.
- Allow imported contacts to be added to a selected or newly created list.
- Process large imports as background jobs in safe batches.
- Show total, queued, processed, created, updated, skipped, and failed counts.
- Provide a downloadable row-level error report.
- Make retries idempotent.
- Scan uploads for malware where the hosting architecture supports it.
- Block macros and unsupported embedded content.
- Apply file-size, sheet-count, column-count, and row-count limits.
- Store uploads in private workspace-scoped storage with signed access.
- Delete temporary parsing files after the retention window.
- Protect against spreadsheet formulas when exporting row-level error reports.

### Phase 7 completion criteria

- A user can upload a spreadsheet, review mappings and duplicate behavior, confirm once, and monitor the import to completion.
- Retrying a failed job cannot duplicate successfully imported records.

## Phase 8: Background jobs and multi-step workflows

- Add a durable job model for imports, scraping, CRM synchronization, exports, and multi-step Agent plans.
- Persist step-level status and results.
- Allow safe cancellation.
- Retry transient failures with limits and backoff.
- Resume jobs after process restarts.
- Notify the user when a job completes, fails, or requires input.
- Let the chat continue while a job runs.
- Display linked jobs inside their originating conversation.
- Use per-step idempotency keys.
- Define rollback or compensating behavior for partially completed plans.
- Prevent two active jobs from mutating the same record incompatibly.
- Preserve an immutable execution plan snapshot for audit.

## Phase 9: Agent planning

- Support bounded multi-step plans only after single-tool execution is reliable.
- Show the proposed plan before executing write steps.
- Re-plan when a tool fails or data changes, but never broaden permissions automatically.
- Limit plan length, total tool calls, elapsed time, records affected, and estimated cost.
- Stop and request input when required fields or assumptions are unresolved.
- Do not allow the Agent to create recurring automations without explicit user configuration.
- Provide reusable workflow templates for common tasks only after their manual flows are stable.

Example plan:

1. Find the target company.
2. Identify its primary contact.
3. Create a follow-up task.
4. Create a draft quote.
5. Return links to both records.

The Agent must not send the quote unless that additional external action is separately confirmed.

## Data model improvements

### Task lifecycle

Consider extending task statuses to:

- `open`
- `in_progress`
- `blocked`
- `waiting`
- `completed`
- `canceled`

Optional additions:

- Progress percentage
- Blocker reason
- Checklist or subtasks
- Started timestamp

### Quote delivery and engagement

Add separate delivery events so the Agent can distinguish message delivery from quote-page engagement:

- Email queued
- Email sent
- Delivered
- Bounced
- Email opened
- Link opened
- Section viewed
- PDF downloaded
- Accepted
- Rejected

Store intended recipients and tracking context. Do not assume that a link opener is the original recipient because links may be forwarded.

### Activity timestamps

- Normalize `last_activity_at` for companies, contacts, and deals.
- Define which events update each timestamp.
- Add indexes required for stale-record queries.

## Security and privacy requirements

- Derive workspace ID and user ID from the authenticated server session.
- Never trust workspace or actor identifiers supplied by the model.
- Apply existing user permissions to Agent reads and writes.
- Never expose API keys, provider secrets, CRM tokens, payment credentials, or service-role credentials.
- Treat uploaded files, CRM fields, notes, knowledge documents, and scraped content as untrusted data rather than instructions.
- Defend against prompt injection and indirect prompt injection.
- Limit query result size and require filters for broad data requests.
- Require confirmation for bulk exports and sensitive data access.
- Encrypt sensitive persisted Agent data where necessary.
- Define retention periods for conversations, attachments, tool logs, and generated files.
- Add rate limits, token limits, maximum tool rounds, timeouts, and request-size limits.
- Enforce CSRF protection and authenticated origins for Agent endpoints.
- Reject unsupported MIME types and mismatched file signatures.
- Sanitize filenames and generated downloads.
- Use short-lived signed URLs for private attachments.
- Redact personal data and secrets from application logs, traces, provider errors, and analytics.
- Define regional data-processing and residency requirements before expanding beyond the current hosting region.
- Document subprocessors and model-provider data-retention settings.
- Support workspace data export and deletion requirements.
- Add abuse detection for scraping, bulk exports, prompt flooding, and attempts to discover other tenants.

## Prompt and tool security

- Version system prompts and tool instructions.
- Treat system instructions and authenticated permissions as higher priority than user or retrieved content.
- Wrap retrieved content in clearly marked data boundaries.
- Never allow retrieved text to enable tools, change permissions, or override confirmation rules.
- Add adversarial tests for indirect prompt injection in notes, documents, websites, imported spreadsheets, and CRM payloads.
- Validate all tool arguments after model generation and again inside the domain service.
- Keep tool error messages useful without exposing database structure or secrets.
- Require allowlisted destinations for any future external-fetch tool.

## Audit and undo

- Record all tool calls with user, workspace, conversation, request ID, arguments, result, latency, and affected records.
- Mask secrets and sensitive personal data in logs.
- Add undo for operations with a reliable inverse.
- Store before/after snapshots only where required and within the retention policy.
- Do not offer undo for external side effects that cannot actually be reversed.

## AI runtime and observability

- Reuse the configured workspace BYOK provider and platform fallback policy.
- Add model/tool compatibility checks.
- Track response latency, tool latency, token usage, provider, model, retries, and failure reason.
- Track tool-selection accuracy, confirmation cancellation rate, import error rate, and task completion rate.
- Add circuit breakers and bounded retries for provider failures.
- Prevent duplicate execution when a user retries or reloads.
- Define cost limits per workspace and per operation.
- Record first-token latency, total response latency, retrieval latency, and tool duration separately.
- Record provider fallback and degraded-mode events.
- Add dashboards for request volume, success rate, approval rate, cancellations, retries, and partial failures.
- Alert on error-rate spikes, latency regressions, runaway token use, repeated permission failures, and background-job backlog.
- Add trace correlation IDs across chat request, model call, tool call, database mutation, and background job.

## Model routing and provider compatibility

- Define minimum capabilities for Agent models: tool calling, structured output, sufficient context window, and predictable JSON behavior.
- Verify provider/model capability when a BYOK configuration is saved.
- Route simple classification and entity-resolution work to a lower-cost model where reliable.
- Route complex analysis and planning to an Agent-capable model.
- Fall back only to models that support the required tool schema.
- Do not silently fall back from a workspace BYOK provider to platform AI if the workspace policy disables fallback.
- Show the effective provider and model in admin diagnostics.
- Maintain provider-specific adapters for APIs that are not truly OpenAI-compatible.
- Add compatibility tests for every supported provider.

## Internationalization and locale behavior

- Answer in the user's selected language by default.
- Preserve proper names, IDs, and original customer content.
- Parse localized dates, decimal separators, and currency formats.
- Confirm interpreted dates and currencies before write actions.
- Use the workspace timezone for shared records and display the user's timezone when different.
- Avoid translating database enum values directly; map them through localized product labels.
- Evaluate entity matching across diacritics, transliteration, and CJK names.

## Super Admin controls

- Global Agent enable/disable switch.
- Per-workspace rollout state.
- Read-only versus write-enabled mode.
- Allowed provider/model list.
- Platform model and fallback configuration.
- Per-workspace daily/monthly token and cost ceilings.
- Tool-level enable/disable controls.
- Maximum import and export sizes.
- Background-job concurrency limits.
- Redacted operational logs and trace search.
- Emergency kill switch for all write tools.
- Feature flags for incremental rollout.

Super Admin access to conversation content must require an explicit support workflow, a reason, audit logging, and the minimum access duration possible.

## User settings

- Enable or disable Agent for the workspace where permitted.
- Choose whether platform fallback is allowed when BYOK fails.
- Set default Agent language and timezone behavior.
- Configure optional confirmation preferences without bypassing mandatory confirmations.
- View usage and limits.
- View and delete conversation history.
- View saved memories when long-term memory is introduced.
- View Agent audit history relevant to the user.

## Notifications and human handoff

- Notify users only when a long-running job completes, fails, or needs input.
- Link notifications back to the originating conversation and result.
- Allow the user to assign a failed or ambiguous Agent task to a team member.
- Preserve the Agent's concise summary, attempted steps, and failure reason for handoff.
- Avoid repeated notifications for unchanged job states.

## Testing and evaluation strategy

### Deterministic tests

- Tool input validation
- Workspace and role isolation
- Entity relationship constraints
- Idempotency and replay
- Approval expiration and payload binding
- Import parsing, mapping, deduplication, and formula safety
- Background-job retry and resume
- Audit completeness and secret redaction

### Agent evaluations

- Correct tool selection
- Correct entity selection
- Correct refusal when information or permission is missing
- No cross-workspace leakage
- Factual accuracy against seeded database fixtures
- Correct distinction between facts and recommendations
- Date, timezone, locale, and currency interpretation
- Prompt-injection resistance
- Confirmation compliance
- Recovery from tool and provider failures

### End-to-end scenarios

- Ask for a deal stage by company name.
- Ask whether the latest quote was sent and viewed.
- Ask for overdue tasks related to a deal.
- Resolve duplicate company names.
- Create a task after confirmation.
- Create a quote draft without sending it.
- Import contacts from CSV/XLSX with duplicates and invalid rows.
- Cancel a background import.
- Deny an unauthorized member action.
- Resume a conversation after navigation and refresh.

Maintain a regression dataset of realistic Vietnamese and English prompts plus the other supported application languages.

## Performance targets

- Chat shell opens without waiting for workspace data queries.
- Simple read answer target: first visible response within 2 seconds under normal conditions.
- Single-tool result target: within 5 seconds under normal conditions.
- Long tasks acknowledge and create a background job promptly rather than holding the request open.
- Chat UI must not materially increase initial application bundle size or navigation latency.
- Fetch conversation history lazily and paginate older messages.
- Use bounded result sets and server-side aggregation.

Exact service-level objectives should be finalized after baseline measurements in staging.

## Rollout plan

1. Internal development workspaces with read-only tools.
2. Seeded-data automated evaluation and security testing.
3. Internal production workspace with feature flag.
4. Selected beta workspaces in read-only mode.
5. Single-record write tools for selected workspaces.
6. Import and background jobs with strict limits.
7. Broader beta after accuracy, latency, cost, and incident thresholds are met.
8. General availability with documented support and rollback procedures.

Each rollout stage must have a kill switch and a documented rollback path.

## Failure and recovery behavior

- Provider unavailable: preserve the message and offer retry or approved fallback.
- Tool timeout: report an unknown result until idempotency status is checked.
- Partial import: preserve successful rows and provide failed rows without duplicating on retry.
- Permission changed during execution: stop before the next mutation.
- Record changed after preview: invalidate approval and regenerate the preview.
- Conversation state corrupted: recover messages from persisted events where possible.
- Background worker outage: leave jobs queued and resume safely.
- Deployment rollback: maintain compatible tool and database schema versions.

## Operational runbook requirements

- How to disable the Agent globally or per workspace.
- How to disable a single tool.
- How to identify a conversation, tool call, or job from a correlation ID.
- How to retry or cancel stuck jobs safely.
- How to investigate provider failures without viewing secrets.
- How to rotate encryption keys and provider credentials.
- How to respond to suspected cross-tenant leakage.
- How to process conversation export and deletion requests.
- How to roll back an Agent deployment and preserve queued jobs.

## Recommended delivery order

1. Global chat widget and conversation persistence.
2. Read-only Company, Contact, Lead, Deal, Quote, and Task tools.
3. Entity resolution and page context.
4. Workspace analytics tools.
5. Shared internal action registry.
6. Confirmation cards and audit logging.
7. Single-record write tools.
8. CSV/XLSX import and duplicate handling.
9. Durable background jobs.
10. Quote delivery tracking improvements.
11. Undo support and operational dashboards.
12. Super Admin controls and feature flags.
13. Multilingual and provider compatibility evaluation.
14. Production security, load, and regression testing.
15. Staged rollout, monitoring, and operational runbooks.

## Dependencies and prerequisites

- Stable workspace session and permission APIs.
- Shared domain services extracted from MCP and UI server actions.
- Private attachment storage and retention lifecycle.
- Durable background-job execution.
- Agent-capable provider/model availability.
- Conversation and tool-audit database migrations.
- Feature-flag infrastructure for read and write modes.
- Monitoring and alerting destination.
- Seeded multi-workspace evaluation fixtures.

## Decisions to finalize before implementation

These choices must be recorded in an architecture decision log before their dependent phase begins:

- Whether members can read all workspace records or only assigned/owned records.
- Conversation, attachment, audit, and tool-result retention periods.
- Background job infrastructure and worker hosting.
- Maximum file size, row count, and records per bulk operation for each plan.
- Workspace BYOK fallback policy and supported Agent-capable models.
- Which single-record actions may use one-click confirmation.
- Which actions require owner/admin approval instead of the requesting member's confirmation.
- Whether undo creates compensating records or restores before-state snapshots.
- Data residency requirements for initial beta countries.
- Support access procedure for viewing customer conversation content.
- Initial latency, availability, cost, and accuracy release thresholds.
- Quote email delivery provider and webhook event contract.

Unresolved decisions must not be replaced by silent implementation assumptions.

## Release gates

### Read-only beta gate

- Zero cross-workspace records in isolation tests.
- Required factual-answer evaluation threshold is met on seeded fixtures.
- No critical prompt-injection finding remains open.
- Provider failure and fallback behavior is verified.
- Agent can be disabled per workspace and globally.

### Write beta gate

- Every mutation has schema validation, authorization, idempotency, confirmation, and audit coverage.
- Payload-bound approval expiration is verified.
- Duplicate execution tests pass during timeout and retry scenarios.
- Emergency write-tool kill switch is verified.

### Bulk workflow gate

- Import limits, private storage, parsing safety, deduplication, cancellation, and retry tests pass.
- Partial failures produce accurate downloadable reports.
- Worker restart and deployment rollback recovery are verified.

### General availability gate

- Monitoring, alerting, cost limits, retention jobs, operational runbooks, and support escalation are live.
- Supported providers pass the compatibility suite.
- Load tests meet the approved service targets.
- Security review and privacy review have no unresolved critical findings.

## Milestone deliverables

### Milestone A: Read-only foundation

- Chat shell
- Conversation persistence
- Page context
- Read tools
- Entity resolution
- Record links and citations
- Read-only security tests

### Milestone B: Guided actions

- Shared action registry
- Confirmation cards
- Single-record writes
- Idempotency
- Audit trail
- Permission tests

### Milestone C: Bulk workflows

- CSV/XLSX import
- Mapping and deduplication
- Background jobs
- Progress and error reports
- Cancellation and safe retries

### Milestone D: Production readiness

- Analytics
- Model routing
- Provider compatibility suite
- Super Admin controls
- Evaluation harness
- Cost and latency dashboards
- Incident runbooks
- Staged rollout and rollback validation

## Beta milestone

The first Agent beta is complete when it can:

- Open from every authenticated page.
- Persist conversations across navigation and refresh.
- Understand the current Company, Contact, Deal, Quote, or Task page.
- Search live workspace data with workspace-safe queries.
- Answer factual questions with timestamps and record links.
- Explain ambiguity and ask the user to choose a record.
- Summarize Company 360 and Deal 360 data.
- Report quote delivery state and recorded engagement without overstating certainty.
- Report open, overdue, completed, and canceled tasks.
- Separate factual data from AI recommendations.
- Operate in read-only mode until the write-action milestone is approved.

## Later production milestone

The production Agent is complete when it additionally supports:

- Confirmed single-record mutations.
- Safe CSV/XLSX imports.
- Background workflows.
- Paid and external actions with strong confirmation.
- Complete audit history.
- Permission and workspace isolation tests.
- Prompt-injection defenses.
- Reliable idempotency and retry behavior.
- Monitoring, cost controls, incident diagnostics, and retention policies.
