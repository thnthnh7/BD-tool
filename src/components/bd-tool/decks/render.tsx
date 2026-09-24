"use client";

import type { DeckSlideData } from "@/lib/deck-content";
import type { Client, CompanySettings } from "@/lib/types";
import { BlueDeck } from "./blue";
import { BroadsideDeck } from "./broadside";
import { useDeck } from "./context";
import { EmeraldDeck } from "./emerald";
import { MonochromeDeck } from "./monochrome";
import { NeoGridDeck } from "./neo-grid";
import { SignalDeck } from "./signal";

export function DeckSlideView({
  slide,
  settings,
  client,
}: {
  slide: DeckSlideData;
  settings: CompanySettings;
  client: Client | null;
}) {
  const deck = useDeck();
  const props = { slide, settings, client };
  switch (deck.id) {
    case "neo-grid":
      return <NeoGridDeck {...props} />;
    case "emerald":
      return <EmeraldDeck {...props} />;
    case "broadside":
      return <BroadsideDeck {...props} />;
    case "monochrome":
      return <MonochromeDeck {...props} />;
    case "blue":
      return <BlueDeck {...props} />;
    default:
      return <SignalDeck {...props} />;
  }
}
