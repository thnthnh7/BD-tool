export const DECK_STYLE_IDS = ["signal", "neo-grid", "emerald", "broadside", "monochrome", "blue"] as const;

export type DeckStyleId = (typeof DECK_STYLE_IDS)[number];

export type DeckPalette = {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
  paper: string;
  line: string;
};

export const DECK_PALETTES: Record<DeckStyleId, DeckPalette> = {
  signal: { bg: "0E1C36", ink: "F4EFE4", muted: "B7A98A", accent: "C4A46A", accentInk: "0E1C36", paper: "F4EFE4", line: "2A3F66" },
  "neo-grid": { bg: "F4F1EA", ink: "111111", muted: "3F3F3F", accent: "E6FF00", accentInk: "111111", paper: "FFFEF8", line: "111111" },
  emerald: { bg: "064E3B", ink: "F6F1E7", muted: "D6CBB8", accent: "F6F1E7", accentInk: "064E3B", paper: "0B1F3A", line: "C4B49A" },
  broadside: { bg: "14110F", ink: "F6F1E7", muted: "C4B8A8", accent: "FF5A1F", accentInk: "14110F", paper: "1C1917", line: "3A332C" },
  monochrome: { bg: "F7F4EE", ink: "111111", muted: "3F3F3F", accent: "111111", accentInk: "F7F4EE", paper: "F7F4EE", line: "111111" },
  blue: { bg: "F7F3EA", ink: "102033", muted: "4B5563", accent: "1D4ED8", accentInk: "FFFFFF", paper: "FFFFFF", line: "D6D3C9" },
};

const LEGACY_DECK_IDS: Record<string, DeckStyleId> = {
  editorial: "emerald",
  clinic: "blue",
  industrial: "neo-grid",
  studio: "broadside",
  brief: "monochrome",
};

export type DeckStyle = {
  id: DeckStyleId;
  name: string;
  blurb: string;
  surface: "dark" | "light";
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  accentInk: string;
  card: string;
  border: string;
  chrome: string;
  radius: number;
  titleWeight: number;
  tracking: string;
  serif: boolean;
  palette: DeckPalette;
};

function deckStyle(
  id: DeckStyleId,
  name: string,
  blurb: string,
  extras: { surface: "dark" | "light"; radius: number; titleWeight: number; tracking: string; serif: boolean },
): DeckStyle {
  const palette = DECK_PALETTES[id];
  return {
    id,
    name,
    blurb,
    ...extras,
    background: `#${palette.bg}`,
    foreground: `#${palette.ink}`,
    muted: `#${palette.muted}`,
    accent: `#${palette.accent}`,
    accentInk: `#${palette.accentInk}`,
    card: `#${palette.paper}`,
    border: `#${palette.line}`,
    chrome: `#${palette.bg}`,
    palette,
  };
}

export const DECK_STYLES: DeckStyle[] = [
  deckStyle("signal", "Signal", "Panel navy bên trái, giấy kem bên phải. Trang giá chia đôi.", {
    surface: "dark",
    radius: 0,
    titleWeight: 700,
    tracking: "-0.02em",
    serif: true,
  }),
  deckStyle("neo-grid", "Neo-Grid Bold", "Khối vàng và ô viền đen. Hạng mục là lưới thô.", {
    surface: "light",
    radius: 0,
    titleWeight: 800,
    tracking: "-0.04em",
    serif: false,
  }),
  deckStyle("emerald", "Emerald Editorial", "Bìa tạp chí emerald, tiêu đề serif, mục có số lớn.", {
    surface: "dark",
    radius: 0,
    titleWeight: 700,
    tracking: "-0.02em",
    serif: true,
  }),
  deckStyle("broadside", "Broadside", "Headline báo trên nền tối, một accent cam.", {
    surface: "dark",
    radius: 0,
    titleWeight: 800,
    tracking: "-0.045em",
    serif: false,
  }),
  deckStyle("monochrome", "Monochrome", "Sổ cái, kẻ tóc, chỉ mực đen.", {
    surface: "light",
    radius: 0,
    titleWeight: 700,
    tracking: "0em",
    serif: true,
  }),
  deckStyle("blue", "Blue Professional", "Trang kem, thẻ cobalt. Hạng mục hai cột.", {
    surface: "light",
    radius: 16,
    titleWeight: 700,
    tracking: "-0.02em",
    serif: false,
  }),
];

export function isDeckStyleId(value: string | undefined): value is DeckStyleId {
  return DECK_STYLE_IDS.some((id) => id === value);
}

export function canonicalDeckStyleId(id: string | undefined): DeckStyleId {
  if (id && isDeckStyleId(id)) return id;
  if (id && LEGACY_DECK_IDS[id]) return LEGACY_DECK_IDS[id];
  return "signal";
}

export function resolveDeckStyle(id: string | undefined): DeckStyle {
  const canonical = canonicalDeckStyleId(id);
  return DECK_STYLES.find((item) => item.id === canonical) || DECK_STYLES[0];
}
