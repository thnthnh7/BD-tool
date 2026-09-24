import { Group, Paper, Text, Title } from "@mantine/core";
import { Plus, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/mantine-link";
import classes from "@/styles/leadely-dashboard.module.css";

export function LeadelyBanner() {
  return (
    <Paper radius="lg" className={classes.banner} px="lg" py="md">
      <svg className={classes.bannerArt} viewBox="0 0 1200 120" preserveAspectRatio="xMaxYMid slice" aria-hidden>
        <circle cx="980" cy="20" r="70" fill="rgba(255,255,255,0.08)" />
        <circle cx="1120" cy="88" r="90" fill="rgba(16,185,129,0.22)" />
        <path d="M760 120 C860 20 980 20 1200 80 L1200 120 Z" fill="rgba(255,255,255,0.06)" />
        <rect x="900" y="28" width="86" height="64" rx="14" fill="rgba(255,255,255,0.1)" />
        <rect x="1010" y="44" width="64" height="48" rx="12" fill="rgba(255,255,255,0.08)" />
      </svg>
      <div className={classes.bannerCopy}>
        <Title order={3} c="white" fw={700} style={{ fontSize: 20, lineHeight: "26px" }}>
          Turn conversations into opportunities
        </Title>
        <Text size="sm" mt={4} mb={10} lineClamp={1} style={{ color: "rgba(255,255,255,0.78)", maxWidth: 640 }}>
          Let AI handle the busy work, so you can focus on what matters — building relationships.
        </Text>
        <Group gap="sm">
          <LinkButton href="/app/leads/scrape" variant="white" color="dark" h={36} leftSection={<Sparkles size={15} />}>
            Find leads
          </LinkButton>
          <LinkButton href="/app/quotes/new" variant="outline" color="gray" h={36} leftSection={<Plus size={15} />} styles={{ root: { color: "white", borderColor: "rgba(255,255,255,0.35)" } }}>
            New quote
          </LinkButton>
        </Group>
      </div>
    </Paper>
  );
}
