import { Center, Container, Text, Title } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { OnboardingForm } from "@/components/onboarding-form";
import { SectionPanel } from "@/components/leadely/section-panel";
import { AppLogo } from "@/components/leadely/app-logo";
import { redirect } from "next/navigation";
import { loadPublicBetaOffer } from "@/lib/platform/beta";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: requestedPlanId } = await searchParams;
  const context = await requireUser();
  if (context.kind === "workspace") redirect("/app");
  if (context.kind === "platform") redirect("/app/platform/plans");

  const betaOffer = await loadPublicBetaOffer();
  return (
    <Center mih="100vh" p="md">
      <Container size="md" w="100%">
      <SectionPanel>
        <AppLogo tagline />
        <Title order={2} mt="lg">
          Create workspace
        </Title>
        <Text size="sm" c="dimmed" mt="xs">
          Set up a place for your leads, customers and sales work. It only takes a minute.
        </Text>
        <OnboardingForm requestedPlanId={requestedPlanId} betaOffer={betaOffer} />
      </SectionPanel>
      </Container>
    </Center>
  );
}
