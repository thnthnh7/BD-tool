"use client";

import { useState } from "react";
import { Alert, Badge, Button, Group, Radio, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { createWorkspaceAction } from "@/lib/auth/actions";
import { formatVnd } from "@/lib/money";

type PlanOption = {
  id: string;
  name: string;
  badge: string;
  isFree: boolean;
  priceMonthly: number;
};

export function OnboardingForm({ plans }: { plans: PlanOption[] }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [type, setType] = useState("personal");
  const [planId, setPlanId] = useState(plans[0]?.id || "");

  async function onSubmit(formData: FormData) {
    setError("");
    setPending(true);
    formData.set("type", type);
    formData.set("planId", planId);
    const result = await createWorkspaceAction(formData);
    if (result?.error) setError(result.error);
    setPending(false);
  }

  return (
    <form action={onSubmit}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="planId" value={planId} />
      <Stack mt="lg" gap="md">
        <Radio.Group value={type} onChange={setType} label="Workspace type">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm" mt="xs">
            <Radio.Card value="personal" p="md" withBorder>
              <Text fw={700}>Cá nhân</Text>
              <Text size="xs" c="dimmed" mt={4}>
                Làm việc một mình, không invite.
              </Text>
            </Radio.Card>
            <Radio.Card value="company" p="md" withBorder>
              <Text fw={700}>Công ty</Text>
              <Text size="xs" c="dimmed" mt={4}>
                Có team, MST và billing VAT.
              </Text>
            </Radio.Card>
          </SimpleGrid>
        </Radio.Group>

        <TextInput name="name" required label="Workspace name" placeholder="Tên hiển thị / tên công ty" />

        <Radio.Group value={planId} onChange={setPlanId} label="Plan">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm" mt="xs">
            {plans.map((plan) => (
              <Radio.Card key={plan.id} value={plan.id} p="md" withBorder>
                <Group justify="space-between" wrap="nowrap" gap="xs" mih={22}>
                  <Text fw={700}>{plan.name}</Text>
                  {plan.badge ? (
                    <Badge color="leadely" variant="light" size="sm">
                      {plan.badge}
                    </Badge>
                  ) : null}
                </Group>
                <Text fw={700} mt="xs">
                  {plan.isFree ? "Miễn phí" : `${formatVnd(plan.priceMonthly)}/tháng`}
                </Text>
              </Radio.Card>
            ))}
          </SimpleGrid>
        </Radio.Group>

        {error ? <Alert color="red">{error}</Alert> : null}
        <Button type="submit" loading={pending}>
          {pending ? "Creating…" : "Continue"}
        </Button>
      </Stack>
    </form>
  );
}
