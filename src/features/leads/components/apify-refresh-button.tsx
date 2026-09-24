"use client";

import { useState } from "react";
import { ActionIcon, Button, Tooltip } from "@mantine/core";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { refreshApifyConnectionAction, unlinkApifyConnectionAction } from "@/features/leads/server/apify-connection";

export function ApifyRefreshButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return <Tooltip label="Đồng bộ usage từ Apify" withArrow>
    <ActionIcon
      aria-label="Đồng bộ usage từ Apify"
      variant="subtle"
      color="gray"
      size={24}
      loading={pending}
      onClick={async () => {
        setPending(true);
        const formData = new FormData();
        formData.set("action", "refresh");
        await refreshApifyConnectionAction(formData);
        setPending(false);
        router.refresh();
      }}
    >
      <RefreshCw size={13} />
    </ActionIcon>
  </Tooltip>;
}

export function ApifyUnlinkButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return <Button
    variant="subtle"
    color="red"
    size="compact-sm"
    loading={pending}
    onClick={async () => {
      if (!window.confirm("Gỡ tài khoản Apify khỏi workspace này?")) return;
      setPending(true);
      const formData = new FormData();
      formData.set("action", "unlink");
      await unlinkApifyConnectionAction(formData);
      setPending(false);
      router.refresh();
    }}
  >
    Gỡ kết nối
  </Button>;
}
