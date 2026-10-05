"use client";

import { useState } from "react";
import { Alert, Box, Button, Group, Paper, Radio, SimpleGrid, Stack, Text, TextInput, ThemeIcon } from "@mantine/core";
import { Building2, Check, UserRound } from "lucide-react";
import { createWorkspaceAction } from "@/lib/auth/actions";

type WorkspaceType = "personal" | "company";

const nextSteps = [
  "You’ll become the workspace owner.",
  "Your workspace starts on the Free plan.",
  "Add leads, contacts and deals after setup.",
  "Upgrade only when you need more features.",
];

export function OnboardingForm({ requestedPlanId }: { requestedPlanId?: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [type, setType] = useState<WorkspaceType>("personal");

  async function onSubmit(formData: FormData) {
    setError("");
    setPending(true);
    formData.set("type", type);
    const result = await createWorkspaceAction(formData);
    if (result?.error) setError(result.error);
    setPending(false);
  }

  const isCompany = type === "company";

  return (
    <form action={onSubmit}>
      <input type="hidden" name="type" value={type} />
      {requestedPlanId ? <input type="hidden" name="requestedPlanId" value={requestedPlanId} /> : null}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mt="xl">
        <Paper withBorder radius="lg" p={{ base: "lg", sm: "xl" }} style={{ height: "100%" }}>
        <Stack gap="lg" h="100%">
          <Box>
            <Text fw={800} size="lg">Workspace details</Text>
            <Text size="sm" c="dimmed" mt={4}>
              Choose the setup that fits how you work today.
            </Text>
          </Box>

          <Radio.Group value={type} onChange={(value) => setType(value as WorkspaceType)} label="Workspace type">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="xs">
              <Radio.Card
                value="personal"
                p="md"
                radius="md"
                withBorder
                style={{
                  cursor: "pointer",
                  borderColor: !isCompany ? "var(--mantine-color-leadely-6)" : undefined,
                  background: !isCompany ? "var(--mantine-color-leadely-0)" : undefined,
                  boxShadow: !isCompany ? "0 0 0 1px var(--mantine-color-leadely-6)" : undefined,
                  transition: "border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease",
                }}
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <ThemeIcon color="leadely" variant={!isCompany ? "filled" : "light"} radius="md">
                    <UserRound size={17} />
                  </ThemeIcon>
                  <Radio.Indicator color="leadely" />
                </Group>
                <Text fw={700} mt="md">Personal</Text>
                <Text size="xs" c="dimmed" mt={4} lh={1.45}>
                  For individuals managing their own sales workflow.
                </Text>
              </Radio.Card>

              <Radio.Card
                value="company"
                p="md"
                radius="md"
                withBorder
                style={{
                  cursor: "pointer",
                  borderColor: isCompany ? "var(--mantine-color-leadely-6)" : undefined,
                  background: isCompany ? "var(--mantine-color-leadely-0)" : undefined,
                  boxShadow: isCompany ? "0 0 0 1px var(--mantine-color-leadely-6)" : undefined,
                  transition: "border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease",
                }}
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <ThemeIcon color="leadely" variant={isCompany ? "filled" : "light"} radius="md">
                    <Building2 size={17} />
                  </ThemeIcon>
                  <Radio.Indicator color="leadely" />
                </Group>
                <Text fw={700} mt="md">Company</Text>
                <Text size="xs" c="dimmed" mt={4} lh={1.45}>
                  For teams, company details and business documents.
                </Text>
              </Radio.Card>
            </SimpleGrid>
          </Radio.Group>

          <TextInput
            name="name"
            required
            label={isCompany ? "Company name" : "Workspace name"}
            placeholder={isCompany ? "Acme Corporation" : "My workspace"}
            size="md"
          />

          {error ? <Alert color="red">{error}</Alert> : null}

          <Box mt="auto" pt="sm">
            <Button type="submit" loading={pending} fullWidth size="md">
              {pending ? "Creating workspace…" : "Create free workspace"}
            </Button>
            <Text size="xs" c="dimmed" ta="center" mt="xs">
              Free plan · No credit card required
            </Text>
          </Box>
        </Stack>
        </Paper>

        <Paper
          withBorder
          radius="lg"
          p={{ base: "lg", sm: "xl" }}
          bg="var(--mantine-color-leadely-0)"
          style={{ borderColor: "var(--mantine-color-leadely-2)", height: "100%" }}
        >
          <Text fw={800} size="lg">What happens next</Text>
          <Text size="sm" c="dimmed" mt={4}>
            Start with the essentials and shape your workspace as you grow.
          </Text>

          <Stack gap="md" mt="lg">
            {nextSteps.map((step) => (
              <Group key={step} gap="sm" wrap="nowrap" align="flex-start">
                <ThemeIcon color="leadely" variant="filled" radius="xl" size={24} mt={1}>
                  <Check size={14} strokeWidth={3} />
                </ThemeIcon>
                <Text size="sm" fw={600}>{step}</Text>
              </Group>
            ))}
          </Stack>

          <Paper withBorder radius="md" p="md" mt="lg" bg="white">
            <Text size="xs" tt="uppercase" fw={800} c="leadely.7" lts={0.5}>
              {isCompany ? "Company workspace" : "Personal workspace"}
            </Text>
            <Text size="sm" mt={6} c="dimmed" lh={1.5}>
              {isCompany
                ? "Best for collaborating with a team and managing business documents."
                : "Best for working independently with your own customers and sales pipeline."}
            </Text>
          </Paper>
        </Paper>
      </SimpleGrid>
    </form>
  );
}
