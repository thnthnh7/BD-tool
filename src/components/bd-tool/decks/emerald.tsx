"use client";

import { Box, Text } from "@mantine/core";
import type { DeckSlideData } from "@/lib/deck-content";
import { DECK_PALETTES } from "@/lib/deck-styles";
import type { Client, CompanySettings } from "@/lib/types";
import { serifTitle, VndFigure } from "./bits";
import classes from "./deck-stage.module.css";

const palette = DECK_PALETTES.emerald;
const emerald = `#${palette.bg}`;
const cream = `#${palette.ink}`;
const navy = `#${palette.paper}`;

export function EmeraldDeck({
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
  if (slide.layout === "grid") return <Index slide={slide} />;
  if (slide.layout === "closing") return <Colophon slide={slide} settings={settings} />;
  return <Spread slide={slide} />;
}

function Masthead({ label, color }: { label: string; color: string }) {
  return (
    <Box>
      <Box h={2} bg={color} />
      <Box mt={4} h={1} bg={color} />
      <Text mt={8} size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.32em", color }}>
        {label}
      </Text>
    </Box>
  );
}

function Cover({ slide, settings, client }: { slide: DeckSlideData; settings: CompanySettings; client: Client | null }) {
  return (
    <Box className={classes.pad} bg={emerald} mih={540} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <Masthead label={`${settings.shortName}  ·  Proposal`} color={cream} />
      <Box>
        <h2 style={serifTitle("clamp(2.4rem, 5vw, 4.2rem)", cream)}>{slide.title}</h2>
        <Text mt="md" maw={520} c={cream} opacity={0.8}>
          {slide.body}
        </Text>
      </Box>
      <Box bg={navy} p="lg" maw={360}>
        <Text size="xs" tt="uppercase" style={{ letterSpacing: "0.22em", color: cream, opacity: 0.7 }}>
          Prepared for
        </Text>
        <Text mt={6} fw={700} c={cream} size="lg">
          {client?.companyName || "Khách hàng"}
        </Text>
      </Box>
    </Box>
  );
}

function Spread({ slide }: { slide: DeckSlideData }) {
  const text = slide.body || "";
  const drop = text.slice(0, 1);
  const rest = text.slice(1);
  return (
    <Box className={`${classes.pad} ${classes.emeraldSpread}`} bg={cream} c={navy} mih={540}>
      <Box>
        <Text size="xs" tt="uppercase" fw={700} c={emerald} style={{ letterSpacing: "0.28em" }}>
          {slide.eyebrow}
        </Text>
        <h2 style={{ ...serifTitle("clamp(1.8rem, 3vw, 2.8rem)", navy), marginTop: 12 }}>{slide.title}</h2>
        {text ? (
          <Text mt="lg" lh={1.75} c="#1C1917">
            <span style={{ float: "left", fontFamily: "var(--font-deck-serif), Georgia, serif", fontSize: "3.4rem", lineHeight: 0.8, paddingRight: 10, color: emerald }}>{drop}</span>
            {rest}
          </Text>
        ) : null}
      </Box>
      <Box bg={navy} c={cream} p="lg">
        {(slide.bullets || slide.steps?.map((step) => `${step.number}  ${step.title}`) || []).map((item) => (
          <Text key={item} py={8} size="sm" style={{ borderBottom: "1px solid rgba(246,241,231,0.25)" }}>
            {item}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

function Index({ slide }: { slide: DeckSlideData }) {
  return (
    <Box className={classes.pad} bg={cream} mih={540}>
      <Text size="xs" tt="uppercase" fw={700} c={emerald} style={{ letterSpacing: "0.28em" }}>
        {slide.eyebrow}
      </Text>
      <h2 style={{ ...serifTitle("clamp(1.8rem, 3vw, 2.6rem)", navy), marginTop: 8 }}>{slide.title}</h2>
      <Box mt={28}>
        {slide.cards?.map((card, index) => (
          <Box key={card.title + (card.meta || "")} py="md" style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12, borderTop: `1px solid ${emerald}` }}>
            <Text style={{ ...serifTitle("1.8rem", emerald) }}>{String(index + 1).padStart(2, "0")}</Text>
            <Box>
              <Box style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <Text fw={700} c={navy}>
                  {card.title}
                </Text>
                <Text size="sm" fw={700} c={emerald} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {card.meta}
                </Text>
              </Box>
              {card.body ? (
                <Text size="sm" c="#57534E" mt={4} lineClamp={2}>
                  {card.body}
                </Text>
              ) : null}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Price({ slide }: { slide: DeckSlideData }) {
  return (
    <Box className={classes.pad} bg={emerald} mih={540} style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.32em", color: cream }}>
        {slide.statLabel}
      </Text>
      {slide.stat ? <Box mt="sm"><VndFigure value={slide.stat} size="clamp(2.4rem, 5vw, 4.2rem)" color={cream} serif /></Box> : null}
      <Text mt="lg" maw={480} c={cream} opacity={0.8}>
        {slide.body}
      </Text>
    </Box>
  );
}

function Colophon({ slide, settings }: { slide: DeckSlideData; settings: CompanySettings }) {
  return (
    <Box className={classes.pad} bg={cream} mih={540} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <Masthead label={settings.shortName} color={navy} />
      <h2 style={serifTitle("clamp(2rem, 4vw, 3.4rem)", navy)}>{slide.title}</h2>
      <Box className={classes.broadCols}>
        {slide.bullets?.map((item) => (
          <Text key={item} size="sm" c="#44403C" style={{ borderTop: `1px solid ${emerald}`, paddingTop: 8 }}>
            {item}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
