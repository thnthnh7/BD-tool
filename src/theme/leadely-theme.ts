import { createTheme, type MantineColorsTuple } from "@mantine/core";

export const leadely: MantineColorsTuple = [
  "#ECFDF5",
  "#D1FAE5",
  "#A7F3D0",
  "#6EE7B7",
  "#34D399",
  "#10B981",
  "#059669",
  "#047857",
  "#065F46",
  "#064E3B",
];

export const teal: MantineColorsTuple = [
  "#F0FDFA",
  "#CCFBF1",
  "#99F6E4",
  "#5EEAD4",
  "#2DD4BF",
  "#14B8A6",
  "#0D9488",
  "#0F766E",
  "#115E59",
  "#134E4A",
];

export const theme = createTheme({
  primaryColor: "leadely",
  primaryShade: 7,
  fontFamily: "var(--font-geist-sans), Geist, Inter, system-ui, sans-serif",
  fontFamilyMonospace: "var(--font-geist-mono), ui-monospace, monospace",
  headings: {
    fontFamily: "var(--font-geist-sans), Geist, Inter, system-ui, sans-serif",
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "26px", lineHeight: "32px" },
      h2: { fontSize: "22px", lineHeight: "28px" },
      h3: { fontSize: "16px", lineHeight: "22px" },
      h4: { fontSize: "14px", lineHeight: "20px" },
    },
  },
  defaultRadius: "md",
  cursorType: "pointer",
  colors: { leadely, teal },
  black: "#0F172A",
  radius: {
    xs: "6px",
    sm: "8px",
    md: "10px",
    lg: "12px",
    xl: "14px",
  },
  spacing: {
    xs: "8px",
    sm: "12px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  shadows: {
    xs: "0 1px 2px rgba(15, 23, 42, 0.03)",
    sm: "0 4px 14px rgba(15, 23, 42, 0.04)",
    md: "0 12px 32px rgba(15, 23, 42, 0.08)",
    lg: "0 12px 32px rgba(15, 23, 42, 0.08)",
    xl: "0 12px 32px rgba(15, 23, 42, 0.08)",
  },
  fontSizes: {
    xs: "12px",
    sm: "13px",
    md: "14px",
    lg: "16px",
    xl: "22px",
  },
  lineHeights: {
    xs: "16px",
    sm: "18px",
    md: "20px",
    lg: "22px",
    xl: "28px",
  },
  components: {
    Button: {
      defaultProps: { h: 40, radius: "md", fw: 600 },
      styles: {
        root: { fontSize: 14 },
      },
    },
    ActionIcon: {
      defaultProps: { radius: "md", size: 40 },
    },
    TextInput: {
      defaultProps: { size: "sm", radius: "md" },
      styles: {
        input: { height: 40, minHeight: 40, fontSize: 14 },
      },
    },
    PasswordInput: {
      defaultProps: { size: "sm", radius: "md" },
      styles: {
        input: { height: 40, minHeight: 40, fontSize: 14 },
      },
    },
    NativeSelect: {
      defaultProps: { size: "sm", radius: "md" },
      styles: {
        input: { height: 40, minHeight: 40, fontSize: 14 },
      },
    },
    Select: {
      defaultProps: { size: "sm", radius: "md" },
      styles: {
        input: { height: 40, minHeight: 40, fontSize: 14 },
      },
    },
    Textarea: {
      defaultProps: { radius: "md" },
      styles: {
        input: { fontSize: 14, padding: "12px 14px" },
      },
    },
    Checkbox: {
      defaultProps: { radius: "sm", color: "leadely" },
    },
    Badge: {
      defaultProps: { radius: "sm", variant: "light", fw: 600, tt: "none" },
      styles: {
        root: { height: 24, paddingInline: 8, fontSize: 11, textTransform: "none" },
      },
    },
    Paper: {
      defaultProps: { radius: "lg" },
    },
    Card: {
      defaultProps: { radius: "lg" },
    },
    Alert: {
      defaultProps: { radius: "lg" },
    },
    Modal: {
      defaultProps: { radius: "lg", centered: true, overlayProps: { backgroundOpacity: 0.32, color: "#07111F" } },
    },
    Tooltip: {
      defaultProps: { openDelay: 200, radius: "sm" },
    },
    Table: {
      defaultProps: { highlightOnHover: true, verticalSpacing: "sm", horizontalSpacing: "md" },
    },
    NavLink: {
      defaultProps: { variant: "subtle" },
    },
    Anchor: {
      defaultProps: { underline: "never" },
    },
    Notifications: {
      defaultProps: { position: "bottom-right" },
    },
  },
  other: {
    leadelyCanvas: "#F8FAFB",
    leadelySurface: "#FFFFFF",
    leadelyText: "#0F172A",
    leadelyMuted: "#64748B",
    leadelyBorder: "#E2E8F0",
  },
});
