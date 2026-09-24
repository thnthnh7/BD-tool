import { Center } from "@mantine/core";
import { InviteAccept } from "./invite-accept";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { token } = await params;
  const { kind } = await searchParams;
  return (
    <Center mih="100vh" bg="var(--ld-canvas)" p="md">
      <InviteAccept token={token} kind={kind === "platform" ? "platform" : "workspace"} />
    </Center>
  );
}
