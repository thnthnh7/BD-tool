"use client";

import { useState } from "react";
import { ActionIcon, Button, Tooltip } from "@mantine/core";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { refreshApifyConnectionAction, unlinkApifyConnectionAction } from "@/features/leads/server/apify-connection";
import { useTranslations } from "next-intl";

export function ApifyRefreshButton() {
  const t = useTranslations("Apify");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return <Tooltip label={t("sync")} withArrow>
    <ActionIcon
      aria-label={t("sync")}
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
  const t = useTranslations("Apify");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return <Button
    variant="subtle"
    color="red"
    size="compact-sm"
    loading={pending}
    onClick={async () => {
      if (!window.confirm(t("unlinkConfirm"))) return;
      setPending(true);
      const formData = new FormData();
      formData.set("action", "unlink");
      await unlinkApifyConnectionAction(formData);
      setPending(false);
      router.refresh();
    }}
  >
    {t("unlink")}
  </Button>;
}
