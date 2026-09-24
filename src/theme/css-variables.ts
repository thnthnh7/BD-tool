import type { CSSVariablesResolver } from "@mantine/core";

export const leadelyCssVariables: CSSVariablesResolver = () => ({
  variables: {
    "--ld-gradient-brand": "linear-gradient(135deg, #059669 0%, #10B981 45%, #14B8A6 100%)",
    "--ld-gradient-ai": "linear-gradient(135deg, rgba(236,253,245,.86) 0%, rgba(240,253,250,.96) 100%)",
    "--ld-shadow-panel": "0 1px 2px rgba(15,23,42,.03)",
    "--ld-shadow-float": "0 12px 32px rgba(15,23,42,.08)",
  },
  light: {
    "--ld-canvas": "#F8FAFB",
    "--ld-surface": "#FFFFFF",
    "--ld-surface-subtle": "#F7FAF9",
    "--ld-text": "#0F172A",
    "--ld-text-muted": "#748098",
    "--ld-border": "#E7EBF0",
    "--ld-divider": "#EEF2F6",
  },
  dark: {
    "--ld-canvas": "#0B1220",
    "--ld-surface": "#0F172A",
    "--ld-surface-subtle": "#111C2D",
    "--ld-text": "#F8FAFC",
    "--ld-text-muted": "#94A3B8",
    "--ld-border": "#243247",
    "--ld-divider": "#1E293B",
  },
});
