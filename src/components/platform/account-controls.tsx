"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ActionIcon, Alert, Button, Code, Group, Menu, Modal, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Ban, Building2, CirclePlay, Ellipsis, KeyRound, PackageX, RotateCcw, Trash2 } from "lucide-react";
import {
  hardDeleteAccountAction,
  revokeInviteAction,
  sendPasswordResetAction,
  setAccountStatusAction,
  setWorkspacePlanActivationAction,
} from "@/lib/platform/ops";

type Dialog = "suspend" | "soft_delete" | "hard_delete" | "deactivate_plan" | "reactivate_plan" | null;

export function AccountControls({
  userId, email, status, role, canMutate, workspaceId, workspaceName, planName, planDeactivated,
}: {
  userId: string;
  email: string;
  status: string;
  role: string;
  canMutate: boolean;
  workspaceId?: string | null;
  workspaceName?: string | null;
  planName?: string | null;
  planDeactivated?: boolean;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const canManagePlan = canMutate && role === "owner" && Boolean(workspaceId && planName);

  function closeDialog() {
    if (pending) return;
    setDialog(null);
    setReason("");
    setConfirmation("");
    setError("");
  }

  function run(action: () => Promise<{ error?: string; url?: string } | void>, onSuccess?: () => void) {
    startTransition(async () => {
      setError("");
      const result = await action();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (result && "url" in result && result.url) setResetUrl(result.url);
      onSuccess?.();
    });
  }

  function updateAccount(mode: "suspend" | "restore" | "soft_delete") {
    const form = new FormData();
    form.set("userId", userId);
    form.set("mode", mode);
    run(() => setAccountStatusAction(form), closeDialog);
  }

  function updatePlan(mode: "deactivate" | "reactivate") {
    if (!workspaceId) return;
    if (mode === "deactivate" && !reason.trim()) {
      setError("Enter a reason before deactivating the plan.");
      return;
    }
    const form = new FormData();
    form.set("workspaceId", workspaceId);
    form.set("mode", mode);
    form.set("reason", reason.trim());
    run(() => setWorkspacePlanActivationAction(form), closeDialog);
  }

  function sendResetLink() {
    const form = new FormData();
    form.set("email", email);
    run(() => sendPasswordResetAction(form));
  }

  function hardDelete() {
    const form = new FormData();
    form.set("userId", userId);
    form.set("confirm", confirmation);
    run(() => hardDeleteAccountAction(form), closeDialog);
  }

  const supportCanSuspend = !canMutate && !["support", "super_admin"].includes(role) && status === "active";
  if (!canMutate && !supportCanSuspend) return null;

  return (
    <>
      <Menu shadow="md" width={240} position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${email}`}><Ellipsis size={18} /></ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {workspaceId ? (
            <Menu.Item component={Link} href={`/app/platform/workspaces/${workspaceId}`} leftSection={<Building2 size={15} />}>
              View workspace
            </Menu.Item>
          ) : null}
          {status === "active" ? (
            <Menu.Item leftSection={<Ban size={15} />} onClick={() => setDialog("suspend")}>Suspend account</Menu.Item>
          ) : canMutate ? (
            <Menu.Item leftSection={<RotateCcw size={15} />} onClick={() => updateAccount("restore")}>Restore account</Menu.Item>
          ) : null}
          {canMutate ? (
            <Menu.Item leftSection={<KeyRound size={15} />} onClick={sendResetLink} disabled={pending}>Create password reset link</Menu.Item>
          ) : null}
          {canManagePlan ? (
            <>
              <Menu.Divider />
              <Menu.Label>Plan</Menu.Label>
              <Menu.Item
                color={planDeactivated ? "teal" : "orange"}
                leftSection={planDeactivated ? <CirclePlay size={15} /> : <PackageX size={15} />}
                onClick={() => setDialog(planDeactivated ? "reactivate_plan" : "deactivate_plan")}
              >
                {planDeactivated ? "Reactivate plan" : "Deactivate plan"}
              </Menu.Item>
            </>
          ) : null}
          {canMutate && status === "active" ? (
            <>
              <Menu.Divider />
              <Menu.Label>Danger zone</Menu.Label>
              <Menu.Item color="red" leftSection={<Trash2 size={15} />} onClick={() => setDialog("soft_delete")}>Soft delete account</Menu.Item>
            </>
          ) : null}
          {canMutate && status === "deleted" ? (
            <>
              <Menu.Divider />
              <Menu.Label>Danger zone</Menu.Label>
              <Menu.Item color="red" leftSection={<Trash2 size={15} />} onClick={() => setDialog("hard_delete")}>Permanently delete account</Menu.Item>
            </>
          ) : null}
        </Menu.Dropdown>
      </Menu>

      <Modal opened={dialog === "suspend"} onClose={closeDialog} title="Suspend account" centered>
        <Stack gap="md">
          <Text size="sm">Suspend <strong>{email}</strong>? This person will no longer be able to sign in until the account is restored.</Text>
          {error ? <Alert color="red">{error}</Alert> : null}
          <Group justify="flex-end"><Button variant="default" onClick={closeDialog}>Cancel</Button><Button color="orange" loading={pending} onClick={() => updateAccount("suspend")}>Suspend</Button></Group>
        </Stack>
      </Modal>

      <Modal opened={dialog === "soft_delete"} onClose={closeDialog} title="Soft delete account" centered>
        <Stack gap="md">
          <Text size="sm">Soft delete <strong>{email}</strong>? Sign-in will be blocked, while the account can still be restored later.</Text>
          {error ? <Alert color="red">{error}</Alert> : null}
          <Group justify="flex-end"><Button variant="default" onClick={closeDialog}>Cancel</Button><Button color="red" loading={pending} onClick={() => updateAccount("soft_delete")}>Soft delete</Button></Group>
        </Stack>
      </Modal>

      <Modal opened={dialog === "hard_delete"} onClose={closeDialog} title="Permanently delete account" centered>
        <Stack gap="md">
          <Alert color="red">This action cannot be undone.</Alert>
          <Text size="sm">Type <Code>{email}</Code> to confirm.</Text>
          <TextInput value={confirmation} onChange={(event) => setConfirmation(event.currentTarget.value)} placeholder={email} />
          {error ? <Alert color="red">{error}</Alert> : null}
          <Group justify="flex-end"><Button variant="default" onClick={closeDialog}>Cancel</Button><Button color="red" loading={pending} disabled={confirmation !== email} onClick={hardDelete}>Delete permanently</Button></Group>
        </Stack>
      </Modal>

      <Modal opened={dialog === "deactivate_plan"} onClose={closeDialog} title="Deactivate workspace plan" centered>
        <Stack gap="md">
          <div><Text fw={600}>{workspaceName || "Workspace"} · {planName}</Text><Text size="sm" c="dimmed">Paid features will stop immediately. The workspace and its data remain available.</Text></div>
          <Textarea required label="Reason" placeholder="Why is this plan being deactivated?" minRows={3} value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
          {error ? <Alert color="red">{error}</Alert> : null}
          <Group justify="flex-end"><Button variant="default" onClick={closeDialog}>Cancel</Button><Button color="orange" loading={pending} onClick={() => updatePlan("deactivate")}>Deactivate plan</Button></Group>
        </Stack>
      </Modal>

      <Modal opened={dialog === "reactivate_plan"} onClose={closeDialog} title="Reactivate workspace plan" centered>
        <Stack gap="md">
          <Text size="sm">Reactivate <strong>{planName}</strong> for <strong>{workspaceName || "this workspace"}</strong> using its latest subscription status?</Text>
          {error ? <Alert color="red">{error}</Alert> : null}
          <Group justify="flex-end"><Button variant="default" onClick={closeDialog}>Cancel</Button><Button loading={pending} onClick={() => updatePlan("reactivate")}>Reactivate plan</Button></Group>
        </Stack>
      </Modal>

      <Modal opened={Boolean(resetUrl)} onClose={() => setResetUrl("")} title="Password reset link" centered>
        <Stack gap="md"><Text size="sm">Send this secure link to <strong>{email}</strong>.</Text><Code style={{ overflowWrap: "anywhere" }}>{resetUrl}</Code><Group justify="flex-end"><Button onClick={() => navigator.clipboard.writeText(resetUrl)}>Copy link</Button></Group></Stack>
      </Modal>
    </>
  );
}

export function RevokeInviteButton({ id, kind }: { id: string; kind: "workspace" | "platform" }) {
  return (
    <form action={async (formData) => { await revokeInviteAction(formData); }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <Button type="submit" variant="subtle" color="red" size="compact-sm">Revoke</Button>
    </form>
  );
}
