import type { ReactNode } from "react";
import { Box } from "@mantine/core";

export function ContentContainer({ children }: { children: ReactNode }) {
  return <Box w="100%">{children}</Box>;
}
