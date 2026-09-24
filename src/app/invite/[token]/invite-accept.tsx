"use client";

import { useState } from "react";
import { Alert, Anchor, Button, Paper, Text, Title } from "@mantine/core";
import { AppLogo } from "@/components/leadely/app-logo";
import { acceptInvite, acceptPlatformInvite } from "@/lib/auth/actions";
import classes from "@/styles/leadely-surfaces.module.css";

export function InviteAccept({ token, kind }: { token: string; kind: "workspace" | "platform" }) {
  const [error, setError] = useState("");

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" w="100%" className={classes.panel}>
      <AppLogo tagline />
      <Title order={2} mt="lg">
        Lời mời tham gia
      </Title>
      <Text size="sm" c="dimmed" mt="xs">
        Account này sẽ nhận đúng 1 role theo invite. Nếu bạn đã có role khác, hãy dùng email khác.
      </Text>
      {error ? (
        <Alert color="red" mt="md">
          {error}
        </Alert>
      ) : null}
      <Button
        fullWidth
        mt="lg"
        onClick={async () => {
          setError("");
          const result = kind === "platform" ? await acceptPlatformInvite(token) : await acceptInvite(token);
          if (result.error) {
            setError(result.error);
            return;
          }
          window.location.href = kind === "platform" ? "/app/platform/plans" : "/app";
        }}
      >
        Chấp nhận lời mời
      </Button>
      <Text size="sm" mt="md">
        Chưa có tài khoản?{" "}
        <Anchor href={`/signup?invite=${token}`} fw={700} underline="always">
          Đăng ký
        </Anchor>
      </Text>
    </Paper>
  );
}
