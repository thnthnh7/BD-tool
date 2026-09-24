"use client";

import { Box, Text } from "@mantine/core";
import type { DeckSlideData } from "@/lib/deck-content";
import { DECK_PALETTES } from "@/lib/deck-styles";
import type { Client, CompanySettings } from "@/lib/types";
import { serifTitle, VndFigure } from "./bits";
import classes from "./deck-stage.module.css";

const palette = DECK_PALETTES.monochrome;
const paper = `#${palette.bg}`;
const ink = `#${palette.ink}`;

export function MonochromeDeck({
  slide,
  settings,
  client,
}: {
  slide: DeckSlideData;
  settings: CompanySettings;
  client: Client | null;
}) {
  if (slide.layout === "cover") return <Cover slide={slide} settings={settings} client={client} />;
  if (slide.layout === "stat") return <Price slide={slide} />;
  if (slide.layout === "grid") return <Table slide={slide} />;
  if (slide.layout === "closing") return <Terms slide={slide} />;
  return <Definitions slide={slide} />;
}

function Cover({ slide, settings, client }: { slide: DeckSlideData; settings: CompanySettings; client: Client | null }) {
  const rows = [
    ["Khách", client?.companyName || "Khách hàng"],
    ["Đơn vị", settings.shortName],
    ["Hiệu lực", slide.bullets?.[1]?.replace("Hiệu lực đến: ", "") || ""],
  ];
  return (
    <Box className={classes.pad} bg={paper} mih={540} style={{ display: "flex", flexDirection: "column" }}>
      <Box h={2} bg={ink} />
      <Text mt="sm" size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.28em" }}>
        {slide.eyebrow}
      </Text>
      <h2 style={{ ...serifTitle("clamp(2rem, 4vw, 3.4rem)", ink), marginTop: 28 }}>{slide.title}</h2>
      <Text mt="md" maw={520} c="#3F3F3F">
        {slide.body}
      </Text>
      <Box mt="auto" pt={32}>
        {rows.map(([label, value]) => (
          <Box key={label} py={8} style={{ display: "grid", gridTemplateColumns: "120px 1fr", borderTop: `1px solid ${ink}` }}>
            <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.14em" }}>
              {label}
            </Text>
            <Text size="sm">{value}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Definitions({ slide }: { slide: DeckSlideData }) {
  const rows = [
    ...(slide.body ? [["Nội dung", slide.body]] : []),
    ...(slide.bullets || []).map((item) => ["", item] as [string, string]),
    ...(slide.steps || []).map((step) => [step.number, `${step.title} — ${step.body}`] as [string, string]),
  ];
  return (
    <Box className={classes.pad} bg={paper} mih={540}>
      <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.22em" }}>
        {slide.eyebrow}
      </Text>
      <h2 style={{ ...serifTitle("clamp(1.7rem, 3vw, 2.5rem)", ink), marginTop: 12 }}>{slide.title}</h2>
      <Box mt={28}>
        {rows.map(([label, value]) => (
          <Box key={label + value} py={10} style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 12, borderTop: `1px solid ${ink}` }}>
            <Text size="xs" fw={700}>
              {label}
            </Text>
            <Text size="sm" lh={1.6}>
              {value}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Table({ slide }: { slide: DeckSlideData }) {
  return (
    <Box className={classes.pad} bg={paper} mih={540}>
      <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.22em" }}>
        {slide.title}
      </Text>
      <Box mt="lg">
        {slide.cards?.map((card) => (
          <div key={card.title + (card.meta || "")} className={classes.ledger} style={{ borderColor: ink }}>
            <Text fw={700} size="sm">
              {card.title}
            </Text>
            <Text size="sm" c="#3F3F3F" lineClamp={2}>
              {card.body}
            </Text>
            <Text size="sm" style={{ fontVariantNumeric: "tabular-nums" }}>
              {card.meta}
            </Text>
          </div>
        ))}
      </Box>
    </Box>
  );
}

function Price({ slide }: { slide: DeckSlideData }) {
  return (
    <Box className={classes.pad} bg={paper} mih={540}>
      <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.22em" }}>
        {slide.title}
      </Text>
      <Box mt={28}>
        {slide.bullets?.map((item) => (
          <Text key={item} py={8} size="sm" style={{ borderTop: `1px solid ${ink}` }}>
            {item}
          </Text>
        ))}
        <Box mt={4} pt="md" style={{ borderTop: `3px double ${ink}` }}>
          <Text size="xs" tt="uppercase" fw={700}>
            {slide.statLabel}
          </Text>
          {slide.stat ? <VndFigure value={slide.stat} size="clamp(2rem, 4vw, 3.2rem)" color={ink} serif /> : null}
        </Box>
      </Box>
    </Box>
  );
}

function Terms({ slide }: { slide: DeckSlideData }) {
  return (
    <Box className={classes.pad} bg={paper} mih={540}>
      <h2 style={serifTitle("clamp(1.8rem, 3vw, 2.6rem)", ink)}>{slide.title}</h2>
      <Text mt="sm" size="sm" maw={560}>
        {slide.body}
      </Text>
      <Box mt={32}>
        {slide.bullets?.map((item, index) => (
          <Box key={item} py={12} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 12, borderTop: `1px solid ${ink}` }}>
            <Text fw={700}>{String(index + 1).padStart(2, "0")}</Text>
            <Text size="sm">{item}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
