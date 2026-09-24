"use client";

import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { leadelyCssVariables, theme } from "@/theme";

export function LeadelyProvider({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={leadelyCssVariables} defaultColorScheme="light">
      <Notifications position="bottom-right" />
      {children}
    </MantineProvider>
  );
}
