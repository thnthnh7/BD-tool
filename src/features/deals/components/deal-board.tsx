import type { CSSProperties } from "react";
import { Group, Text } from "@mantine/core";
import { CompanyMark } from "@/components/leadely/company-mark";
import { LinkAnchor } from "@/components/mantine-link";
import { StageMover } from "@/features/deals/components/stage-mover";
import type { DealListItem } from "@/features/deals/server/actions";
import type { Database } from "@/lib/database.types";
import { currencyTotals, formatCurrency, formatCurrencyTotals } from "@/lib/money";
import classes from "@/styles/leadely-kanban.module.css";
import { useTranslations } from "next-intl";

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

function mixHex(from: string, to: string, amount: number) {
  const channel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
  const mixed = [1, 3, 5].map((offset) => Math.round(channel(from, offset) + (channel(to, offset) - channel(from, offset)) * amount));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function stageAccent(stage: Stage, openStages: Stage[]) {
  if (stage.stage_type === "won") return "#047857";
  if (stage.stage_type === "lost") return "#94A3B8";
  const index = Math.max(0, openStages.findIndex((item) => item.id === stage.id));
  const span = Math.max(openStages.length - 1, 1);
  return mixHex("#A7F3D0", "#059669", index / span);
}

export function DealBoard({ stages, deals }: { stages: Stage[]; deals: DealListItem[] }) {
  const t = useTranslations("Deals");
  const openStages = stages.filter((stage) => stage.stage_type !== "won" && stage.stage_type !== "lost");
  const stageOptions = stages.map((stage) => ({ id: stage.id, name: stage.name }));

  return (
    <div className={classes.scroller}>
      <div className={classes.board}>
        {stages.map((stage) => {
          const column = deals.filter((deal) => deal.stage_id === stage.id);
          const totals = currencyTotals(column.map((deal) => ({ amount: deal.amount || 0, currency: deal.currency })));
          return (
            <section
              key={stage.id}
              className={classes.column}
              style={{ "--stage-accent": stageAccent(stage, openStages) } as CSSProperties}
            >
              <div className={classes.accent} aria-hidden />
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text fw={700} size="sm" lineClamp={1}>
                  {stage.name}
                </Text>
                <Text size="xs" c="dimmed" fw={700}>
                  {column.length}
                </Text>
              </Group>
              <Text size="xs" c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatCurrencyTotals(totals, true)}
              </Text>
              <div className={classes.cards}>
                {column.map((deal) => (
                  <article key={deal.id} className={classes.card}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap={4}>
                      <LinkAnchor href={`/app/deals/${deal.id}`} fw={600} size="sm" c="var(--ld-text)" lineClamp={2} style={{ flex: 1, minWidth: 0 }}>
                        {deal.title}
                      </LinkAnchor>
                      <StageMover mode="menu" dealId={deal.id} stageId={stage.id} stages={stageOptions} />
                    </Group>
                    <div style={{ marginTop: 4 }}>
                      <CompanyMark name={deal.companies?.name || "—"} logo={deal.companies?.logo_path} size={20} fw={400} />
                    </div>
                    <Text size="sm" fw={700} mt={8} style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(deal.amount, deal.currency)}
                    </Text>
                    <StageMover mode="select" dealId={deal.id} stageId={stage.id} stages={stageOptions} />
                  </article>
                ))}
                {column.length === 0 ? <div className={classes.empty}>{t("emptyTitle")}</div> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
