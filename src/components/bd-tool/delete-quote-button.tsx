"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ActionIcon, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { deleteQuoteAction } from "@/lib/db/actions";

export function DeleteQuoteButton({
  quoteId,
  label,
  appearance = "button",
  redirectTo,
}: {
  quoteId: string;
  label: string;
  appearance?: "button" | "icon";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const name = label.trim() || "quote này";

  async function remove() {
    if (!window.confirm(`Xóa ${name}? Bản này sẽ biến khỏi danh sách.`)) return;
    setPending(true);
    const result = await deleteQuoteAction(quoteId);
    if (result.error) {
      setPending(false);
      notifications.show({ color: "red", message: result.error });
      return;
    }
    if (redirectTo) {
      window.location.assign(redirectTo);
      return;
    }
    router.refresh();
    setPending(false);
  }

  if (appearance === "icon") {
    return (
      <ActionIcon variant="subtle" color="red" size={28} loading={pending} aria-label={`Xóa ${name}`} onClick={() => void remove()}>
        <Trash2 size={16} />
      </ActionIcon>
    );
  }

  return (
    <Button variant="light" color="red" loading={pending} leftSection={<Trash2 size={16} />} onClick={() => void remove()}>
      Delete
    </Button>
  );
}
