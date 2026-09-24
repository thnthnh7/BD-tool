import { Center, Container, Text, Title } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parsePlan } from "@/lib/entitlements";
import { OnboardingForm } from "@/components/onboarding-form";
import { SectionPanel } from "@/components/leadely/section-panel";
import { AppLogo } from "@/components/leadely/app-logo";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const context = await requireUser();
  if (context.kind === "workspace") redirect("/app");
  if (context.kind === "platform") redirect("/app/platform/plans");

  const supabase = await createClient();
  const { data: plans } = await supabase.from("plans").select("*").eq("is_public", true).order("sort_order");

  return (
    <Center mih="100vh" p="md">
      <Container size="sm" w="100%">
      <SectionPanel>
        <AppLogo tagline />
        <Title order={2} mt="lg">
          Create workspace
        </Title>
        <Text size="sm" c="dimmed" mt="xs">
          Public signup always creates an Owner. Personal or company — one account, one workspace.
        </Text>
        <OnboardingForm
          plans={(plans || []).map((row) => {
            const plan = parsePlan(row);
            return {
              id: plan.id,
              name: plan.name,
              badge: plan.badge,
              isFree: plan.isFree,
              priceMonthly: plan.priceMonthly,
            };
          })}
        />
      </SectionPanel>
      </Container>
    </Center>
  );
}
