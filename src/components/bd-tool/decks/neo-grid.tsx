"use client";

import { Box, Text } from "@mantine/core";
import type { DeckSlideData } from "@/lib/deck-content";
import { DECK_PALETTES } from "@/lib/deck-styles";
import type { Client, CompanySettings } from "@/lib/types";
import { LogoPair, sansTitle, VndFigure } from "./bits";
import classes from "./deck-stage.module.css";

const palette = DECK_PALETTES["neo-grid"];
const paper = `#${palette.bg}`;
const ink = `#${palette.ink}`;
const yellow = `#${palette.accent}`;

const frame = { border: `3px solid ${ink}`, background: paper };

export function NeoGridDeck({
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
  if (slide.layout === "grid") return <Cells slide={slide} />;
  if (slide.layout === "closing") return <Close slide={slide} />;
  return <Blocks slide={slide} />;
}

function Cover({ slide, settings, client }: { slide: DeckSlideData; settings: CompanySettings; client: Client | null }) {
  const cells = slide.bullets?.slice(0, 3) || [];
  return (
    <div className={classes.neoCover} style={{ background: paper }}>
      <Box bg={yellow} p={36} style={{ borderBottom: `3px solid ${ink}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <LogoPair settings={settings} client={client} ink={ink} plate={paper} />
        <h2 style={sansTitle("clamp(2.2rem, 5vw, 4rem)", ink)}>{slide.title}</h2>
      </Box>
      <div className={classes.neoCells}>
        {cells.map((item) => (
          <Box key={item} p="md" style={{ ...frame, borderTop: 0, borderLeft: 0 }}>
            <Text size="xs" fw={800} tt="uppercase" style={{ letterSpacing: "0.14em" }}>
              {item}
            </Text>
          </Box>
        ))}
      </div>
    </div>
  );
}

function Blocks({ slide }: { slide: DeckSlideData }) {
  const cells = [
    slide.indexLabel || "01",
    slide.title,
    slide.body || "",
    ...(slide.bullets || []),
    ...(slide.steps || []).map((step) => `${step.number} ${step.title}`),
  ].filter(Boolean).slice(0, 4);
  return (
    <Box bg={paper} mih={540} p={20}>
      <div className={classes.neoCells} style={{ gap: 0 }}>
        {cells.map((item, index) => (
          <Box key={item} p="lg" mih={160} bg={index === 0 ? yellow : paper} style={frame}>
            <Text fw={index === 0 ? 800 : 600} size={index === 0 ? "xl" : "sm"} style={{ fontFamily: "var(--font-deck), sans-serif" }}>
              {item}
            </Text>
          </Box>
        ))}
      </div>
    </Box>
  );
}

function Cells({ slide }: { slide: DeckSlideData }) {
  return (
    <Box bg={paper} mih={540} p={20}>
      <Text size="xs" fw={800} tt="uppercase" mb="sm" style={{ letterSpacing: "0.16em" }}>
        {slide.eyebrow}
      </Text>
      <div className={classes.neoCells}>
        {slide.cards?.map((card) => (
          <Box key={card.title + (card.meta || "")} style={{ ...frame, display: "flex", flexDirection: "column", minHeight: 160 }}>
            <Box p="md" style={{ flex: 1 }}>
              <Text fw={800}>{card.title}</Text>
              {card.body ? (
                <Text size="sm" mt={6} lineClamp={3}>
                  {card.body}
                </Text>
              ) : null}
            </Box>
            {card.meta ? (
              <Box bg={yellow} px="md" py={8} style={{ borderTop: `3px solid ${ink}` }}>
                <Text size="sm" fw={800} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {card.meta}
                </Text>
              </Box>
            ) : null}
          </Box>
        ))}
      </div>
    </Box>
  );
}

function Price({ slide }: { slide: DeckSlideData }) {
  const side = slide.bullets?.slice(0, 4) || [];
  return (
    <div className={classes.neoPrice} style={{ minHeight: 540, background: paper }}>
      <Box bg={yellow} p={36} style={{ ...frame, gridColumn: "1 / -1", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <Text size="xs" fw={800} tt="uppercase" style={{ letterSpacing: "0.16em" }}>
          {slide.statLabel}
        </Text>
        {slide.stat ? <VndFigure value={slide.stat} size="clamp(2.2rem, 5vw, 4rem)" color={ink} /> : null}
      </Box>
      {side.map((item) => (
        <Box key={item} p="md" style={frame}>
          <Text size="sm" fw={700}>
            {item}
          </Text>
        </Box>
      ))}
    </div>
  );
}

function Close({ slide }: { slide: DeckSlideData }) {
  return (
    <Box mih={540} bg={ink} c={paper} p={40} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <Box w={88} h={88} bg={yellow} c={ink} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, letterSpacing: "0.08em" }}>
        NEXT
      </Box>
      <h2 style={sansTitle("clamp(2.4rem, 5vw, 4.2rem)", paper)}>{slide.title}</h2>
      <Text maw={560} c={paper} opacity={0.8}>
        {slide.body}
      </Text>
    </Box>
  );
}
