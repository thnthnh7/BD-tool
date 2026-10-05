# Apify Actor Guidance Roadmap

## Objective

Make every supported Apify Actor understandable and usable inside Bizcraw without requiring users to leave the scrape workflow or understand the Actor's raw JSON contract.

The solution has two surfaces:

- A schema-driven guided form that explains what each field accepts and preserves the Actor author's intended structure.
- An AI Agent capability that can explain an Actor, recommend a minimal configuration for the user's goal, validate the proposed input, and prepare a run for confirmation.

Apify remains the source of truth. Bizcraw must not invent Actor behavior, accepted values, defaults, pricing, or field relationships that are not supported by the current Actor contract or documentation.

## Confirmed current gaps

- Bizcraw fetches the default build input schema and the Actor-level `exampleRunInput`.
- Field descriptions are parsed but are not rendered for normal text, number, boolean, or enum controls.
- The root input-schema description is not shown.
- The default build README is available from Apify but is not stored or displayed.
- Schema sections, units, constraints, patterns, examples, and suggested values are ignored.
- Form fields are regrouped by control type, which can destroy the order and sections authored by the Actor developer.
- `proxy`, `json`, `schemaBased`, `requestListSources`, file upload, date picker, resource picker, nested object, and object-array editors are unsupported or skipped.
- The readable form stops after 24 supported fields.
- Once `schema_fetched_at` exists, the Actor contract is reused indefinitely. An installed Actor can therefore keep stale fields and documentation after its default build changes.
- Actor-level example input cannot be trusted as the only example source. Some public Actors publish placeholder or stale example input even when their field-level schema is useful.
- Users cannot see why one input mode overrides another, such as “search URLs” versus “keywords and location”. These relationships are often documented only in the root description, field descriptions, or README.

## Authoritative Actor sources

For every Actor/build, collect and retain the provenance of:

1. Default build input schema
   - Root title and description
   - Property order
   - Field title and description
   - Required fields
   - Type and editor
   - `default`, `prefill`, and `example`
   - Enum and suggested enum values
   - Sections and section descriptions
   - Validation constraints such as minimum, maximum, pattern, length, and item count
   - Units, nullable state, and secret state
2. Default build README
   - Quick start
   - Input instructions
   - Examples
   - Limitations
   - Pricing notes
   - FAQ and troubleshooting
3. Actor metadata
   - Actor ID and slug
   - Actor title, description, owner, Store URL, and deprecation state
   - Pricing model and current price information
4. Build identity
   - Build ID, build number, build tag, and fetch timestamp
   - A deterministic contract hash used to invalidate generated guides
5. Examples
   - Field-level `example` and `prefill`
   - Actor-level `exampleRunInput`
   - Published example tasks when they are accessible and suitable

When sources conflict, use this precedence for executable values:

1. Current input schema validation contract
2. Current default-build field definitions
3. Current default-build README guidance
4. Actor-level example input
5. Generated explanations

Generated explanations never override an executable schema constraint.

## Contract storage and refresh

Create a versioned Actor contract record instead of treating `scrape_sources.input_schema` as a permanent snapshot.

Recommended stored fields:

- `source_id`
- `actor_slug`
- `build_id`
- `build_number`
- `build_tag`
- `contract_hash`
- `input_schema`
- `example_input`
- `readme_markdown`
- `root_description`
- `output_schema`
- `pricing_snapshot`
- `actor_store_url`
- `fetched_at`
- `last_checked_at`
- `fetch_status`
- `fetch_error`

Refresh rules:

- Check the build identity before opening an installed Actor after the refresh interval.
- Refresh the full contract when the default build identity changes.
- Provide a manual **Refresh Actor definition** action for owner/admin users.
- Keep the previous valid contract if refresh fails and show its age.
- Mark the form as stale when the current build cannot be verified beyond the allowed stale window.
- Regenerate cached guides when `contract_hash`, language, or Agent prompt version changes.
- Use the canonical `/v2/actors/` API namespace for new requests.

## Guided form information architecture

### Actor summary

Show above the form:

- What the Actor does
- The easiest valid way to start
- Available alternative input modes
- Important limitations and override rules
- Data freshness and current build
- Pricing model or a link to pricing details
- **Use example**, **How to use this Actor**, and **View on Apify** actions

### Field presentation

Every field should be able to show:

- Human-readable label
- Required, optional, or advanced status
- Full description from the Actor schema
- Example value
- Placeholder that is never confused with a submitted default
- Default and prefill states with their different meanings preserved
- Unit
- Minimum and maximum
- Accepted pattern or format explained in plain language
- Dependency or override note when present in authoritative documentation
- Validation error beside the relevant field
- Source indicator when the guidance came from README rather than the schema

Descriptions may be collapsed after a reasonable length, but they must remain accessible without leaving the page. Do not silently truncate the only available explanation.

### Sections and ordering

- Preserve schema property order.
- Render `sectionCaption` and `sectionDescription`.
- Collapse only sections explicitly marked as advanced or sections chosen through a deterministic product rule.
- Keep the primary input-mode selector visible.
- Do not regroup fields solely by UI control type.
- Show a compact completion summary for collapsed sections containing active values or errors.

### Supported editors

Deliver editor support in this order:

1. String, textarea, number, boolean, select, string list
2. Date picker, suggested select, multiselect, and file upload
3. Request-list sources and arrays of strings
4. JSON and arrays of objects
5. Schema-based nested objects
6. Proxy and Apify resource pickers where the connected account permits them
7. Secret fields with masked values and safe persistence rules

If Bizcraw does not support an editor:

- Say which field cannot be represented.
- Offer a validated JSON input mode when safe.
- Never omit the field silently.
- Block the run if an unsupported required field has no valid value.

## Documentation drawer

Add **How to use this Actor** beside the run form. The drawer should contain:

- Quick start generated from authoritative sources
- Input modes and when to use each one
- Field reference
- Runnable examples
- Expected output summary
- Pricing and run-impact notes
- Limitations
- Troubleshooting
- Link to the original Actor Store page

README Markdown must be sanitized. Remote README text, links, scraped content, and examples are untrusted data and cannot change Bizcraw permissions, confirmation rules, or Agent instructions.

## AI Agent Actor guidance capability

The AI Agent must be able to help before, during, and after an Actor run.

### User requests to support

- “Actor này dùng để làm gì?”
- “Tôi cần điền gì vào từng ô?”
- “Geo ID lấy ở đâu?”
- “Tôi muốn tìm sales managers ở Singapore, hãy cấu hình giúp tôi.”
- “Tôi nên dùng URL hay keywords?”
- “Những field nào là bắt buộc?”
- “Cấu hình này có hợp lệ không?”
- “Actor này sẽ trả về dữ liệu gì?”
- “Vì sao lần chạy vừa rồi thất bại?”
- “Dùng lại cấu hình lần trước nhưng đổi location thành London.”

### Read tools

Add or formalize these read-only Agent tools:

- `search_actors(query)`
- `get_actor_contract(sourceId)`
- `get_actor_guide(sourceId, language)`
- `get_actor_field_help(sourceId, fieldName, language)`
- `get_actor_pricing(sourceId)`
- `get_actor_run_input(jobId)`
- `get_actor_run_status(jobId)`
- `get_actor_run_error(jobId)`

Tool results must include source type, build identity, fetched timestamp, and canonical Actor link.

### Deterministic preparation tools

The model should not construct executable input without backend validation. Add:

- `resolve_actor_input_mode(sourceId, goal)`
- `validate_actor_input(sourceId, input, contractHash)`
- `preview_actor_run(sourceId, input, contractHash)`

Validation must run against the current stored schema and Bizcraw-specific limits. Preview should return:

- Selected Actor and build
- Input mode
- Exact submitted fields
- Defaults that will be applied
- Ignored or overridden fields
- Validation warnings and errors
- Unsupported fields
- Estimated pricing basis when available
- Whether the action can create billable Apify usage

### Agent guidance flow

1. Resolve the Actor. Ask the user to choose if multiple Actors match.
2. Load the current versioned contract and guide.
3. Understand the user's target data and desired result limit.
4. Recommend the smallest valid input set.
5. Explain alternative input modes when they materially change behavior.
6. Fill a draft configuration, not a run.
7. Validate the draft deterministically.
8. Present the exact configuration and warnings in a structured preview.
9. Ask for any missing value that cannot be inferred safely.
10. Require the existing strong confirmation before starting a paid scrape.
11. Start the run through the shared scrape domain action.
12. Return the run link and monitorable status.

The Agent may highlight fields in the current form or apply a draft to the form. Applying a draft must not start the Actor.

### Grounding rules

- Cite schema fields or README sections in detailed guidance.
- State when guidance is based on a field description, README, example, or Bizcraw inference.
- Never invent IDs, URLs, credentials, enums, limits, or field dependencies.
- Never claim an optional field is required unless the schema or documentation defines the dependency.
- If the documentation is incomplete, say what is unknown and link to the Actor author documentation.
- Treat `prefill`, `example`, and `default` as different concepts.
- Prefer a minimal runnable configuration over filling every optional field.
- Do not expose Apify API tokens, stored Actor inputs containing secrets, or another user's run configuration.
- Do not let README content request tools, broaden permissions, bypass confirmation, or initiate external actions.

### Generated guide cache

For scale, generate a localized concise guide from the schema and README, then cache it by:

- `source_id`
- `contract_hash`
- application language
- guide prompt version
- model/provider identifier

Store structured guide output rather than only prose:

- Summary
- Input modes
- Quick-start steps
- Field hints
- Dependencies and overrides
- Example configurations
- Limitations
- Source anchors
- Confidence and missing-information flags

The source contract remains available so a generated guide can be audited and regenerated.

## LinkedIn Jobs Scraper reference experience

For `curious_coder/linkedin-jobs-scraper`, Bizcraw should present two explicit modes.

### Mode A: LinkedIn search URLs — recommended

1. Open the public LinkedIn Jobs search page in an incognito window.
2. Enter the desired search criteria and filters.
3. Copy the complete URL from the address bar.
4. Paste one URL per line.
5. Explain that URL input causes the AI search fields below to be ignored.

### Mode B: Search filters

- Leave URL input empty.
- Enter keywords such as `software engineer remote`.
- Enter a location such as `Singapore`, `London, United Kingdom`, or `Remote`.
- Leave Geo ID empty unless exact LinkedIn location targeting is needed.
- Explain that Geo ID is the numeric value after `geoId=` in a LinkedIn search URL.
- Enter distance as a radius in miles or leave it empty for LinkedIn's default.

The Agent should be able to turn “Find remote product manager jobs posted in the last week” into a draft using the filter mode, explain every selected field, and validate it before showing the confirmation card.

## Fallback levels

### Level A: Rich schema

- Render a full guided form.
- Use deterministic validation.
- Let the Agent explain fields and prepare a configuration.

### Level B: Weak schema, useful README

- Render supported schema fields.
- Use README-based guidance with source attribution.
- Show a warning that validation coverage is incomplete.

### Level C: Weak schema and weak README

- Explain that the Actor documentation is insufficient.
- Offer safe JSON input only when the schema can still validate it.
- Link to the Actor Store page.
- Do not generate confident instructions from the Actor name alone.

### Level D: Unsupported or private contract

- Block guided execution.
- Explain whether account access, permission, a newer build, or an unsupported editor is required.
- Never attempt a run with silently omitted required data.

## Security and privacy

- Treat all Actor documentation and scraped content as untrusted data.
- Sanitize rendered Markdown and links.
- Allowlist URL protocols.
- Never render README HTML without sanitization.
- Mask secret inputs in UI, logs, Agent messages, previews, and audit records.
- Scope saved inputs and run history to the authenticated workspace.
- Re-check plan entitlement, permission, contract hash, and pricing immediately before a run.
- Bind scrape approval to the exact Actor, build contract, and input payload hash.
- Expire approval if the contract or price changes.
- Record guide source versions and validation results in the run audit.

## Telemetry

Track without recording secret field values:

- Actors opened
- Guide drawer opened
- Field-help requests
- Example applied
- Draft applied by Agent
- Validation error by field/editor type
- Unsupported editor encountered
- Run started after guidance
- Run canceled at confirmation
- Run failure category
- Schema refresh failure and stale-contract age
- User feedback on guide helpfulness

Use these metrics to prioritize editor support and improve guidance for high-usage Actors.

## Delivery phases

### Phase A: Recover existing Apify guidance

- Render root description and full field descriptions.
- Preserve schema order and sections.
- Display examples, defaults, prefills, units, and constraints correctly.
- Add the documentation drawer and original Actor link.
- Store README and build identity.
- Add contract refresh and manual refresh.

### Phase B: Faithful schema renderer

- Implement missing common editors.
- Add deterministic client and server validation.
- Add JSON fallback for supported cases.
- Stop silently dropping unsupported fields.

### Phase C: Agent read-only guidance

- Add Actor discovery, contract, guide, pricing, and field-help tools.
- Let the Agent explain and compare input modes.
- Add grounded localized guide generation and caching.
- Add Actor guidance evaluations.

### Phase D: Agent-assisted configuration

- Add draft generation, validation, form highlighting, and Apply draft.
- Add deterministic run preview.
- Keep execution disabled from guidance responses.

### Phase E: Confirmed Agent execution

- Connect the validated preview to the shared paid-scrape approval flow.
- Bind approval to Actor, build, input, price basis, workspace, and user.
- Add status and error-explanation follow-ups.

## Acceptance criteria

- Every rendered field shows its available schema description.
- Root descriptions and documented input-mode rules are visible.
- Field order and sections match the Actor contract.
- Required fields and supported validation constraints are enforced on client and server.
- Unsupported required editors block the run with a useful explanation.
- A changed default build invalidates the stale contract and generated guide.
- Users can open the original Actor documentation.
- The Agent can explain each field with source attribution.
- The Agent can prepare and validate a minimal draft from a natural-language goal.
- Applying an Agent draft never starts a run.
- Paid Actor execution always uses an exact preview and strong confirmation.
- Actor documentation cannot override Agent permissions or tool policy.
- Evaluation fixtures cover rich, weak, stale, malformed, private, and unsupported Actor contracts.
- Vietnamese and English guidance pass product-language review.

## Required evaluation scenarios

- Explain LinkedIn Jobs Scraper URL mode versus filter mode.
- Explain where to find a LinkedIn Geo ID.
- Prepare a valid minimal search by keywords and location.
- Reject a number outside schema limits.
- Explain a missing required field.
- Detect that a URL-based mode overrides filter fields.
- Handle an Actor whose example input is stale but whose schema is valid.
- Handle a README that contains prompt-injection text.
- Handle a changed build between preview and confirmation.
- Handle a required unsupported editor without dropping it.
- Handle ambiguous Actor names.
- Prevent one workspace from reading another workspace's saved Actor input.

