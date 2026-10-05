# Bizcraw Agent runbook

The in-app assistant is read-only until a workspace owner turns on confirmed writes. AI runs only with the workspace API key. `platform_flags.ai_enabled` disables the assistant everywhere.

## Turn it off

- Everywhere: Platform Health, clear “In-app assistant”, save switches.
- One workspace: Platform Health, Workspace assistant, set the workspace id and clear Assistant enabled. Owners can do the same in Settings.
- Confirmed writes and imports: clear “Allow confirmed record changes”. This is the write kill switch. It does not delete queued import rows.
- One tool: remove it from `READ_TOOLS` or `WRITE_TOOLS` and deploy. There is no per-tool database switch yet.

## Trace a request

Assistant turns store `request_id` on `agent_messages`, `agent_tool_calls`, and `ai_usage_events`. A workspace without its own API key does not call a platform model.

## Imports

Beta limits are 2 MB, 2,000 rows, and 40 columns. Macro workbooks (`.xlsm`) are rejected. Error downloads prefix cells that start with `=`, `+`, `-`, or `@` so spreadsheet formulas do not run. Retry continues only `queued` rows, so created rows are not inserted again. Cancel sets the job to `canceled`; the next tick will not process it.

Jobs live in Postgres. There is no separate worker. The chat calls `tick` to resume after a restart or a closed request.

## Rollback

The agent tables are additive. Rolling back the app leaves jobs in `queued` or `running`. After the forward deploy, tick again. Do not delete `agent_idempotency_keys` during a retry or completed writes can run twice.

## Conversation content

Super Admin health controls do not show conversation text. Support access to message content is not implemented. Export or deletion of a user’s conversations is a manual database request until a retention job exists. No automatic retention runs yet.

## Suspected cross-tenant data

Disable the assistant globally, then compare `agent_tool_calls.workspace_id` with the record ids in `result`. Read tools always filter `workspace_id` from the server session. A result from another workspace is an incident: keep the tool call row and disable writes.
