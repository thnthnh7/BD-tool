"use client";

import type { CSSProperties } from "react";
import { Box, Group, Text } from "@mantine/core";
import Image from "next/image";
import { clientInitials } from "@/lib/image";
import type { Client, CompanySettings } from "@/lib/types";

export function serifTitle(size: string, color: string): CSSProperties {
  return {
    margin: 0,
    color,
    fontFamily: "var(--font-deck-serif), Georgia, serif",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    fontSize: size,
    lineHeight: 1.12,
    overflowWrap: "anywhere",
  };
}

export function sansTitle(size: string, color: string, weight = 800): CSSProperties {
  return {
    margin: 0,
    color,
    fontFamily: "var(--font-deck), sans-serif",
    fontWeight: weight,
    letterSpacing: "-0.04em",
    fontSize: size,
    lineHeight: 1.05,
    overflowWrap: "anywhere",
  };
}

export function VndFigure({ value, size, color, serif = false }: { value: string; size: string; color: string; serif?: boolean }) {
  const amount = value.replace(/[\s₫]+$/u, "");
  const style = serif ? serifTitle(size, color) : sansTitle(size, color, 800);
  return (
    <div style={{ minWidth: 0, overflow: "hidden" }}>
      <div style={{ ...style, whiteSpace: "nowrap" }}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{amount}</span>
        <span style={{ fontSize: "0.42em", marginLeft: "0.12em" }}>₫</span>
      </div>
    </div>
  );
}

export function LogoPair({
  settings,
  client,
  size = 40,
  ink,
  plate,
}: {
  settings: CompanySettings;
  client: Client | null;
  size?: number;
  ink: string;
  plate: string;
}) {
  return (
    <Group gap="sm" wrap="nowrap">
      {settings.logoPath ? (
        settings.logoPath.startsWith("/") ? (
          <Image src={settings.logoPath} alt={settings.shortName} width={size} height={size} style={{ borderRadius: 8, objectFit: "cover" }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logoPath} alt={settings.shortName} width={size} height={size} style={{ width: size, height: size, borderRadius: 8, objectFit: "contain", background: "white" }} />
        )
      ) : (
        <Box
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            backgroundColor: plate,
            color: ink,
            fontWeight: 800,
            fontSize: size * 0.28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {clientInitials(settings.shortName || "WS")}
        </Box>
      )}
      <Text size="sm" fw={700} c={ink} opacity={0.45}>
        ×
      </Text>
      {client?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={client.logoUrl} alt={client.companyName} width={size} height={size} style={{ width: size, height: size, borderRadius: 8, objectFit: "contain", background: "white", padding: 4 }} />
      ) : (
        <Box
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            backgroundColor: plate,
            color: ink,
            fontWeight: 800,
            fontSize: size * 0.28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {clientInitials(client?.companyName || "KH")}
        </Box>
      )}
    </Group>
  );
}
