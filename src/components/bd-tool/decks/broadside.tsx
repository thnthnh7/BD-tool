"use client";

import { Box, Text } from "@mantine/core";
import type { DeckSlideData } from "@/lib/deck-content";
import { DECK_PALETTES } from "@/lib/deck-styles";
import type { Client, CompanySettings } from "@/lib/types";
import { sansTitle, VndFigure } from "./bits";
import classes from "./deck-stage.module.css";

const palette = DECK_PALETTES.broadside;
const night = `#${palette.bg}`;
const cream = `#${palette.ink}`;
const orange = `#${palette.accent}`;

export function BroadsideDeck({
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
  if (slide.layout === "grid") return <Briefs slide={slide} />;
  if (slide.layout === "closing") return <Close slide={slide} />;
  return <Columns slide={slide} />;
}

function Cover({ slide, settings, client }: { slide: DeckSlideData; settings: CompanySettings; client: Client | null }) {
  return (
    <Box mih={540} bg={night} p={36} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <Text size="xs" fw={800} tt="uppercase" style={{ letterSpacing: "0.34em", color: orange }}>
        {slide.eyebrow}
      </Text>
      <h2 style={{ ...sansTitle("clamp(2.8rem, 6vw, 4.8rem)", cream), textTransform: "uppercase" }}>{slide.title}</h2>
      <Box style={{ display: "flex", justifyContent: "space-between", gap: 16, borderTop: `1px solid ${orange}`, paddingTop: 12 }}>
        <Text size="xs" tt="uppercase" c={cream} style={{ letterSpacing: "0.16em" }}>
          {settings.shortName}
        </Text>
        <Text size="xs" tt="uppercase" c={cream} style={{ letterSpacing: "0.16em" }}>
          {client?.companyName || "Khách hàng"}
        </Text>
      </Box>
    </Box>
  );
}

function Columns({ slide }: { slide: DeckSlideData }) {
  const columns = slide.bullets?.length ? slide.bullets : slide.steps?.map((step) => `${step.title}. ${step.body}`) || [];
  return (
    <Box className={classes.pad} bg={night} mih={540}>
      <h2 style={{ ...sansTitle("clamp(2rem, 4vw, 3.4rem)", cream), textTransform: "uppercase" }}>{slide.title}</h2>
      <Text mt="sm" size="xs" tt="uppercase" style={{ letterSpacing: "0.22em", color: orange }}>
        {slide.eyebrow}
      </Text>
      {slide.body ? (
        <Text mt="md" c={cream} opacity={0.8} maw={640}>
          {slide.body}
        </Text>
      ) : null}
      <div className={classes.broadCols} style={{ marginTop: 28 }}>
        {columns.map((item) => (
          <Text key={item} size="sm" c={cream} lh={1.6} style={{ borderTop: `2px solid ${orange}`, paddingTop: 10 }}>
            {item}
          </Text>
        ))}
      </div>
    </Box>
  );
}

function Briefs({ slide }: { slide: DeckSlideData }) {
  return (
    <Box className={classes.pad} bg={night} mih={540}>
      <Text size="xs" fw={800} tt="uppercase" style={{ letterSpacing: "0.28em", color: orange }}>
        {slide.eyebrow}
      </Text>
      <Box mt="lg">
        {slide.cards?.map((card) => (
          <Box key={card.title + (card.meta || "")} py="md" style={{ borderTop: `1px solid #3A332C` }}>
            <Text size="xs" fw={800} tt="uppercase" c={orange} style={{ letterSpacing: "0.14em" }}>
              {card.meta}
            </Text>
            <Text mt={4} fw={800} size="lg" c={cream} style={{ fontFamily: "var(--font-deck), sans-serif", letterSpacing: "-0.03em" }}>
              {card.title}
            </Text>
            {card.body ? (
              <Text size="sm" c={cream} opacity={0.75} mt={4} lineClamp={2}>
                {card.body}
              </Text>
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Price({ slide }: { slide: DeckSlideData }) {
  return (
    <Box mih={540} bg={orange} c={night} p={40} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <Text size="xs" fw={800} tt="uppercase" style={{ letterSpacing: "0.28em" }}>
        {slide.statLabel}
      </Text>
      {slide.stat ? <VndFigure value={slide.stat} size="clamp(2.6rem, 6vw, 4.6rem)" color={night} /> : null}
      <Text mt="md" maw={480} fw={600}>
        {slide.body}
      </Text>
    </Box>
  );
}

function Close({ slide }: { slide: DeckSlideData }) {
  return (
    <Box mih={540} bg={night} p={36} style={{ display: "flex", alignItems: "flex-end" }}>
      <h2 style={{ ...sansTitle("clamp(3rem, 7vw, 5.4rem)", cream), textTransform: "uppercase" }}>
        {slide.title.split(" ").slice(0, -1).join(" ")}{" "}
        <span style={{ color: orange }}>{slide.title.split(" ").slice(-1)}</span>
      </h2>
    </Box>
  );
}
