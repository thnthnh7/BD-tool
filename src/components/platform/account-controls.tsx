"use client";

import { useState } from "react";
import { Alert, Button, Group, Text, TextInput } from "@mantine/core";
import {
  hardDeleteAccountAction,
  revokeInviteAction,
  sendPasswordResetAction,
  setAccountStatusAction,
} from "@/lib/platform/ops";

export function AccountControls({
  userId,
  email,
  status,
  role,
  canMutate,
}: {
  userId: string;
  email: string;
  status: string;
  role: string;
  canMutate: boolean;
}) {
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");

  async function run(action: (formData: FormData) => Promise<{ error?: string; url?: string } | void>, formData: FormData) {
    setError("");
    const result = await action(formData);
    if (result && "error" in result && result.error) setError(result.error);
    if (result && "url" in result && result.url) setUrl(result.url);
  }

  if (!canMutate) {
    if (role === "support" || role === "super_admin" || status !== "active") return null;
    return (
      <form action={async (formData) => { await run(setAccountStatusAction, formData); }}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="mode" value="suspend" />
        <Button type="submit" variant="subtle" size="compact-sm">
          Suspend
        </Button>
      </form>
    );
  }

  return (
    <Group gap="xs">
      {status === "active" ? (
        <form action={async (formData) => { await run(setAccountStatusAction, formData); }}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="mode" value="suspend" />
          <Button type="submit" variant="subtle" size="compact-sm">
            Suspend
          </Button>
        </form>
      ) : (
        <form action={async (formData) => { await run(setAccountStatusAction, formData); }}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="mode" value="restore" />
          <Button type="submit" variant="subtle" size="compact-sm">
            Restore
          </Button>
        </form>
      )}
      {status === "active" ? (
        <form action={async (formData) => { await run(setAccountStatusAction, formData); }}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="mode" value="soft_delete" />
          <Button type="submit" variant="subtle" color="red" size="compact-sm">
            Soft delete
          </Button>
        </form>
      ) : null}
      {status === "deleted" ? (
        <form action={async (formData) => { await run(hardDeleteAccountAction, formData); }}>
          <input type="hidden" name="userId" value={userId} />
          <TextInput name="confirm" placeholder="Type email" size="xs" w={160} />
          <Button type="submit" color="red" size="compact-sm" mt={4}>
            Hard delete
          </Button>
        </form>
      ) : null}
      <form
        action={async (formData) => {
          formData.set("email", email);
          await run(sendPasswordResetAction, formData);
        }}
      >
        <Button type="submit" variant="subtle" size="compact-sm">
          Reset link
        </Button>
      </form>
      {error ? <Alert color="red">{error}</Alert> : null}
      {url ? <Text size="xs">{url}</Text> : null}
    </Group>
  );
}

export function RevokeInviteButton({ id, kind }: { id: string; kind: "workspace" | "platform" }) {
  return (
    <form action={async (formData) => { await revokeInviteAction(formData); }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <Button type="submit" variant="subtle" color="red" size="compact-sm">
        Revoke
      </Button>
    </form>
  );
}
