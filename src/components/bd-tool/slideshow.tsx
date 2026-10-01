"use client";

import { useMemo, useState } from "react";
import { ActionIcon, Box, Button, Group, Paper, Text } from "@mantine/core";
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, Presentation } from "lucide-react";
import { DeckSlideView } from "@/components/bd-tool/decks/render";
import { LogoPair } from "@/components/bd-tool/decks/bits";
import { DeckContext } from "@/components/bd-tool/decks/context";
import { buildDeckSlides } from "@/lib/deck-content";
import { resolveDeckStyle } from "@/lib/deck-styles";
import { exportQuoteToExcel, exportQuoteToPdf } from "@/lib/exports";
import { exportQuoteToPptx } from "@/lib/quotes/export-pptx";
import type { Client, CompanySettings, Quote } from "@/lib/types";

type SlideshowProps = {
  settings: CompanySettings;
  quote: Quote;
  client: Client | null;
  allowExport?: boolean;
};

export function Slideshow({ settings, quote, client, allowExport = true }: SlideshowProps) {
  const deck = resolveDeckStyle(quote.deckStyle);
  return <SlideshowDeck key={deck.id} settings={settings} quote={quote} client={client} allowExport={allowExport} />;
}

function SlideshowDeck({ settings, quote, client, allowExport = true }: SlideshowProps) {
  const [active, setActive] = useState(0);
  const slides = useMemo(() => buildDeckSlides(settings, quote, client), [client, quote, settings]);
  const deck = resolveDeckStyle(quote.deckStyle);
  const safeActive = Math.min(active, Math.max(0, slides.length - 1));
  const slide = slides[safeActive] || slides[0];

  if (!slide) return null;

  return (
    <DeckContext.Provider value={deck}>
      <Paper
        radius={deck.radius}
        withBorder
        bg={deck.chrome}
        c={deck.foreground}
        style={{
          overflow: "hidden",
          borderColor: deck.border,
          fontFamily: "var(--font-deck), sans-serif",
          ["--mantine-font-family" as string]: "var(--font-deck), sans-serif",
        }}
      >
        <Group justify="space-between" px="md" py="sm" style={{ borderBottom: `1px solid ${deck.border}` }}>
          <Group gap="sm">
            <LogoPair settings={settings} client={client} size={34} ink={deck.accentInk} plate={deck.accent} />
            <Box visibleFrom="sm">
              <Text size="xs" tt="uppercase" c={deck.muted} style={{ letterSpacing: "0.24em" }}>
                {deck.name}
              </Text>
              <Text size="sm" fw={600}>
                {client?.companyName || settings.shortName}
              </Text>
            </Box>
          </Group>
          {allowExport ? (
            <Group gap="xs">
              <Button variant={deck.surface === "dark" ? "white" : "default"} color="dark" size="compact-sm" onClick={() => exportQuoteToExcel(settings, quote, client)} leftSection={<FileSpreadsheet size={14} />}>
                Excel
              </Button>
              <Button variant={deck.surface === "dark" ? "white" : "default"} color="dark" size="compact-sm" onClick={() => exportQuoteToPdf(settings, quote, client)} leftSection={<Download size={14} />}>
                PDF
              </Button>
              <Button variant={deck.surface === "dark" ? "white" : "default"} color="dark" size="compact-sm" onClick={() => void exportQuoteToPptx(settings, quote, client)} leftSection={<Presentation size={14} />}>
                PowerPoint
              </Button>
            </Group>
          ) : null}
        </Group>

        <Box mih={540} style={{ overflow: "hidden", background: deck.background }}>
          <DeckSlideView slide={slide} settings={settings} client={client} />
        </Box>

        <Group justify="space-between" px="md" py="sm" bg={deck.chrome} style={{ borderTop: `1px solid ${deck.border}` }}>
          <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" onClick={() => setActive((value) => Math.max(0, value - 1))} disabled={safeActive === 0} aria-label="Previous slide">
            <ArrowLeft size={18} />
          </ActionIcon>
          <Group gap={8} justify="center" maw="60%">
            {slides.map((item, index) => (
              <Box
                key={`${item.layout}-${item.title}-${index}`}
                component="button"
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Go to slide ${index + 1}`}
                h={8}
                style={{
                  width: index === safeActive ? 30 : 8,
                  border: 0,
                  borderRadius: 99,
                  cursor: "pointer",
                  backgroundColor: index === safeActive ? deck.accent : deck.border,
                }}
              />
            ))}
          </Group>
          <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" onClick={() => setActive((value) => Math.min(slides.length - 1, value + 1))} disabled={safeActive === slides.length - 1} aria-label="Next slide">
            <ArrowRight size={18} />
          </ActionIcon>
        </Group>
      </Paper>
    </DeckContext.Provider>
  );
}
