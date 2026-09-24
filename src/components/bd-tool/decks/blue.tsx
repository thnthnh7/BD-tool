"use client";

import { Box, Text } from "@mantine/core";
import type { DeckSlideData } from "@/lib/deck-content";
import { DECK_PALETTES } from "@/lib/deck-styles";
import type { Client, CompanySettings } from "@/lib/types";
import { LogoPair, sansTitle, VndFigure } from "./bits";
import classes from "./deck-stage.module.css";

const palette = DECK_PALETTES.blue;
const cream = `#${palette.bg}`;
const ink = `#${palette.ink}`;
const cobalt = `#${palette.accent}`;
const card = `#${palette.paper}`;

export function BlueDeck({
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
  if (slide.layout === "grid") return <Cards slide={slide} />;
  if (slide.layout === "closing") return <Close slide={slide} settings={settings} client={client} />;
  return <Pair slide={slide} />;
}

function Cover({ slide, settings, client }: { slide: DeckSlideData; settings: CompanySettings; client: Client | null }) {
  return (
    <Box className={classes.pad} bg={cream} mih={540} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <LogoPair settings={settings} client={client} ink="#FFFFFF" plate={cobalt} />
      <h2 style={sansTitle("clamp(2rem, 4vw, 3.4rem)", ink, 700)}>{slide.title}</h2>
      <Box bg={cobalt} c="#FFFFFF" p="xl" maw={380} ml="auto" style={{ borderRadius: 16 }}>
        <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.2em", opacity: 0.8 }}>
          Prepared for
        </Text>
        <Text mt={6} fw={700} size="lg">
          {client?.companyName || "Khách hàng"}
        </Text>
        <Text mt="sm" size="sm" opacity={0.85}>
          {slide.body}
        </Text>
      </Box>
    </Box>
  );
}

function Pair({ slide }: { slide: DeckSlideData }) {
  const notes = slide.bullets?.length ? slide.bullets : slide.steps?.map((step) => `${step.number}  ${step.title}`) || [];
  return (
    <Box className={`${classes.pad} ${classes.blueSplit}`} bg={cream} mih={540}>
      <Box>
        <Text size="xs" fw={700} tt="uppercase" c={cobalt} style={{ letterSpacing: "0.2em" }}>
          {slide.eyebrow}
        </Text>
        <h2 style={{ ...sansTitle("clamp(1.8rem, 3vw, 2.6rem)", ink, 700), marginTop: 12 }}>{slide.title}</h2>
        {slide.body ? (
          <Text mt="md" c="#4B5563" lh={1.7}>
            {slide.body}
          </Text>
        ) : null}
      </Box>
      <Box style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {notes.map((item) => (
          <Box key={item} bg={card} p="md" style={{ borderRadius: 16, border: `1px solid #${palette.line}` }}>
            <Text size="sm" c={ink}>
              {item}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Cards({ slide }: { slide: DeckSlideData }) {
  return (
    <Box className={classes.pad} bg={cream} mih={540}>
      <Text size="xs" fw={700} tt="uppercase" c={cobalt} style={{ letterSpacing: "0.2em" }}>
        {slide.eyebrow}
      </Text>
      <h2 style={{ ...sansTitle("clamp(1.6rem, 3vw, 2.2rem)", ink, 700), marginTop: 8 }}>{slide.title}</h2>
      <div className={classes.blueModules} style={{ marginTop: 20 }}>
        {slide.cards?.map((cardItem, index) => (
          <Box key={cardItem.title + (cardItem.meta || "")} bg={card} p="md" style={{ borderRadius: 16, border: `1px solid #${palette.line}` }}>
            <Text size="xs" fw={800} c={cobalt}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <Text mt={6} fw={700} c={ink}>
              {cardItem.title}
            </Text>
            {cardItem.body ? (
              <Text size="sm" c="#4B5563" mt={4} lineClamp={3}>
                {cardItem.body}
              </Text>
            ) : null}
            {cardItem.meta ? (
              <Text mt="sm" size="sm" fw={700} c={cobalt} style={{ fontVariantNumeric: "tabular-nums" }}>
                {cardItem.meta}
              </Text>
            ) : null}
          </Box>
        ))}
      </div>
    </Box>
  );
}

function Price({ slide }: { slide: DeckSlideData }) {
  return (
    <Box mih={540} bg={cream} style={{ display: "flex", flexDirection: "column" }}>
      <Box bg={cobalt} c="#FFFFFF" px={40} py={36}>
        <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.2em", opacity: 0.8 }}>
          {slide.statLabel}
        </Text>
        {slide.stat ? <VndFigure value={slide.stat} size="clamp(2rem, 4vw, 3.4rem)" color="#FFFFFF" /> : null}
      </Box>
      <Box className={classes.pad} style={{ flex: 1 }}>
        {slide.bullets?.map((item) => (
          <Text key={item} py={10} size="sm" c={ink} style={{ borderBottom: `1px solid #${palette.line}` }}>
            {item}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

function Close({ slide, settings, client }: { slide: DeckSlideData; settings: CompanySettings; client: Client | null }) {
  return (
    <Box className={classes.pad} bg={cream} mih={540} style={{ display: "flex", alignItems: "center" }}>
      <Box p={36} style={{ border: `2px solid ${cobalt}`, borderRadius: 20, width: "100%" }}>
        <LogoPair settings={settings} client={client} ink="#FFFFFF" plate={cobalt} />
        <h2 style={{ ...sansTitle("clamp(1.8rem, 3vw, 2.8rem)", ink, 700), marginTop: 20 }}>{slide.title}</h2>
        <Text mt="md" maw={560} c="#4B5563" lh={1.7}>
          {slide.body}
        </Text>
      </Box>
    </Box>
  );
}
