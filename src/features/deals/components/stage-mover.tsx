"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon, Menu, NativeSelect } from "@mantine/core";
import { ArrowRightLeft } from "lucide-react";
import { moveDealStageAction } from "@/features/deals/server/actions";
import classes from "@/styles/leadely-kanban.module.css";

export function StageMover({
  dealId,
  stageId,
  stages,
  mode,
}: {
  dealId: string;
  stageId: string;
  stages: { id: string; name: string }[];
  mode: "menu" | "select";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function move(nextStageId: string) {
    if (!nextStageId || nextStageId === stageId || pending) return;
    const form = new FormData();
    form.set("deal_id", dealId);
    form.set("stage_id", nextStageId);
    setPending(true);
    await moveDealStageAction(form);
    setPending(false);
    router.refresh();
  }

  if (mode === "select") {
    return (
      <div className={classes.mobileMove}>
        <NativeSelect
          aria-label="Move to stage"
          value={stageId}
          disabled={pending}
          data={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
          onChange={(event) => move(event.currentTarget.value)}
        />
      </div>
    );
  }

  return (
    <div className={classes.desktopMove}>
      <Menu position="bottom-end" withinPortal shadow="md">
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" size={28} loading={pending} aria-label="Move to stage">
            <ArrowRightLeft size={14} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Move to</Menu.Label>
          {stages.map((stage) => (
            <Menu.Item key={stage.id} disabled={stage.id === stageId} onClick={() => move(stage.id)}>
              {stage.name}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
