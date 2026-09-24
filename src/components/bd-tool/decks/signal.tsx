"use client";

import { Box, Text } from "@mantine/core";
import type { DeckSlideData } from "@/lib/deck-content";
import { DECK_PALETTES } from "@/lib/deck-styles";
import type { Client, CompanySettings } from "@/lib/types";
import { LogoPair, serifTitle, VndFigure } from "./bits";
import classes from "./deck-stage.module.css";

const palette = DECK_PALETTES.signal;
const navy = `#${palette.bg}`;
const bone = `#${palette.paper}`;
const gold = `#${palette.accent}`;
const ink = "#1C1917";

export function SignalDeck({
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
  if (slide.layout === "grid") return <Ledger slide={slide} />;
  if (slide.layout === "closing") return <Close slide={slide} settings={settings} client={client} />;
  return <Split slide={slide} />;
}

function Cover({ slide, settings, client }: { slide: DeckSlideData; settings: CompanySettings; client: Client | null }) {
  return (
    <div className={classes.signalCover}>
      <Box bg={navy} c={bone} p={36} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 240 }}>
        <LogoPair settings={settings} client={client} ink={bone} plate={gold} />
        <Box>
          <Text size="xs" tt="uppercase" style={{ letterSpacing: "0.28em", color: gold }}>
            {settings.shortName}
          </Text>
          <Text mt="sm" size="sm" c={bone} opacity={0.75}>
            {client?.companyName || "Khách hàng"}
          </Text>
        </Box>
      </Box>
      <Box bg={bone} c={ink} p={40} style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 300 }}>
        <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.28em", color: gold }}>
          {slide.eyebrow}
        </Text>
        <Box mt="md" h={2} w={72} bg={gold} />
        <h2 style={{ ...serifTitle("clamp(2rem, 4vw, 3.4rem)", ink), marginTop: 20 }}>{slide.title}</h2>
        <Text mt="lg" maw={460} c="#57534E" lh={1.7}>
          {slide.body}
        </Text>
      </Box>
    </div>
  );
}

function Split({ slide }: { slide: DeckSlideData }) {
  return (
    <Box className={`${classes.signalSplit} ${classes.pad}`} bg={bone} c={ink}>
      <Box>
        <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.28em", color: gold }}>
          {slide.indexLabel} · {slide.eyebrow}
        </Text>
        <Box mt="sm" h={1} bg={gold} />
        <Box mt={6} h={1} bg={gold} />
        <h2 style={{ ...serifTitle("clamp(1.8rem, 3vw, 2.8rem)", ink), marginTop: 20 }}>{slide.title}</h2>
      </Box>
      <Box>
        {slide.body ? (
          <Text c="#57534E" lh={1.7}>
            {slide.body}
          </Text>
        ) : null}
        <Box mt="lg">
          {slide.steps?.map((step) => (
            <Box key={step.number} pl="md" mb="md" style={{ borderLeft: `2px solid ${gold}` }}>
              <Text size="xs" fw={700} c={gold}>
                {step.number}
              </Text>
              <Text fw={700} c={ink}>
                {step.title}
              </Text>
              <Text size="sm" c="#57534E">
                {step.body}
              </Text>
            </Box>
          ))}
          {slide.bullets?.map((item) => (
            <Text key={item} py={8} size="sm" c={ink} style={{ borderTop: `1px solid ${gold}` }}>
              {item}
            </Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function Ledger({ slide }: { slide: DeckSlideData }) {
  return (
    <Box className={classes.pad} bg={bone} c={ink} mih={540}>
      <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.28em", color: gold }}>
        {slide.eyebrow}
      </Text>
      <h2 style={{ ...serifTitle("clamp(1.8rem, 3vw, 2.6rem)", ink), marginTop: 12 }}>{slide.title}</h2>
      <Box mt={28}>
        {slide.cards?.map((card) => (
          <div key={card.title + (card.meta || "")} className={classes.ledger} style={{ borderColor: gold }}>
            <Text fw={700} c={ink}>
              {card.title}
            </Text>
            <Text size="sm" c="#57534E" lineClamp={2}>
              {card.body}
            </Text>
            <Text size="sm" fw={700} c={navy} style={{ fontVariantNumeric: "tabular-nums" }}>
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
    <div className={classes.signalPrice}>
      <Box bg={navy} c={bone} p={40} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: 260 }}>
        <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: "0.28em", color: gold }}>
          {slide.statLabel}
        </Text>
        {slide.stat ? <Box mt="sm"><VndFigure value={slide.stat} size="clamp(2rem, 4vw, 3.4rem)" color={gold} serif /></Box> : null}
        <Text mt="md" maw={420} c={bone} opacity={0.75}>
          {slide.body}
        </Text>
      </Box>
      <Box bg={bone} p={36} style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {slide.bullets?.map((item) => (
          <Text key={item} py={10} size="sm" c={ink} style={{ borderBottom: `1px solid ${gold}` }}>
            {item}
          </Text>
        ))}
      </Box>
    </div>
  );
}

function Close({ slide, settings, client }: { slide: DeckSlideData; settings: CompanySettings; client: Client | null }) {
  return (
    <Box className={classes.pad} bg={bone} c={ink} mih={540} style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <LogoPair settings={settings} client={client} ink={navy} plate={gold} />
      <Box mt="xl" h={2} w={72} bg={gold} />
      <h2 style={{ ...serifTitle("clamp(2rem, 4vw, 3.2rem)", ink), marginTop: 20 }}>{slide.title}</h2>
      <Text mt="md" maw={520} c="#57534E" lh={1.7}>
        {slide.body}
      </Text>
    </Box>
  );
}
