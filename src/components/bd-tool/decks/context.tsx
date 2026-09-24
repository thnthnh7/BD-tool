"use client";

import { createContext, useContext } from "react";
import { resolveDeckStyle, type DeckStyle } from "@/lib/deck-styles";

export const DeckContext = createContext<DeckStyle>(resolveDeckStyle("signal"));

export function useDeck() {
  return useContext(DeckContext);
}
