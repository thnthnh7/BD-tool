import { Alert, Button, Paper, Stack, Text, Title } from "@mantine/core";
import { AppLogo } from "@/components/leadely/app-logo";
import { signOut } from "@/lib/auth/actions";

export default function SeatUnavailablePage() {
  return (
    <Paper withBorder p="xl" maw={520} mx="auto" mt="10vh">
      <Stack gap="md">
        <AppLogo tagline />
        <Title order={2}>Your workspace has reached its seat limit</Title>
        <Alert color="orange">
          The workspace owner and earliest invited members keep access first. Your membership is preserved, but this account is waiting for an available seat.
        </Alert>
        <Text size="sm" c="dimmed">Ask the workspace owner to remove an unused member or upgrade the plan. Access is restored automatically when a seat becomes available.</Text>
        <form action={signOut}><Button type="submit" variant="light">Sign out</Button></form>
      </Stack>
    </Paper>
  );
}
