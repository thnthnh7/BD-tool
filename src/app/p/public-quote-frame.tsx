"use client";

import type { ReactNode } from "react";
import { Box, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { LinkButton } from "@/components/mantine-link";

export function PublicQuoteShell({ children }: { children: ReactNode }) {
  return (
    <Box component="main" mih="100vh" bg="#09090b" p={{ base: "xs", md: "md" }}>
      {children}
    </Box>
  );
}

export function PublicQuoteLoading({ label = "Đang tải báo giá..." }: { label?: string }) {
  return (
    <Center component="main" mih="100vh" bg="#09090b" p="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
    </Center>
  );
}

export function PublicQuoteInvalid() {
  return (
    <Center component="main" mih="100vh" bg="#09090b" p="md">
      <Paper withBorder p="xl" maw={420} ta="center" bg="dark.8" c="white">
        <Stack gap="sm" align="center">
          <Title order={2} c="white">
            Link báo giá không hợp lệ
          </Title>
          <Text size="sm" c="dimmed">
            Vui lòng kiểm tra lại link share hoặc yêu cầu gửi lại báo giá.
          </Text>
          <LinkButton href="/" mt="sm">
            Về trang chính
          </LinkButton>
        </Stack>
      </Paper>
    </Center>
  );
}
