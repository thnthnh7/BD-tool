"use client";

import { useState } from "react";
import { Alert, Anchor, Badge, Button, Group, NativeSelect, Stack, Table, Text, TextInput } from "@mantine/core";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { convertToCompanyAction, createInviteAction, removeMemberAction, setMemberRoleAction, transferOwnerAction } from "@/lib/auth/actions";
import { EntityRow } from "@/components/leadely/entity-row";
import classes from "@/styles/leadely-surfaces.module.css";

export function TeamPanel({
  members,
  viewerRole,
  workspaceType,
  seatLimit,
}: {
  members: Array<{ userId: string; email: string; role: string; displayName: string }>;
  viewerRole: "owner" | "admin";
  workspaceType: "personal" | "company";
  seatLimit: number;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function invite(formData: FormData) {
    setError("");
    const result = await createInviteAction(formData);
    if (result.error) setError(result.error);
    if (result.url) setUrl(result.url);
  }

  async function enableTeam() {
    setError("");
    const result = await convertToCompanyAction();
    if (result?.error) setError(result.error);
  }

  if (workspaceType === "personal") {
    return (
      <Stack gap="md">
        <PageHeader title="Team" subtitle="Invite teammates and manage their workspace roles." />
        <SectionPanel title="Enable team collaboration">
          <Stack gap="md" maw={620}>
            <Text size="sm" c="dimmed">
              This is currently a personal workspace. Convert it to a company workspace to invite members. Your data and current plan will stay unchanged.
            </Text>
            <Text size="sm">
              Your plan supports {seatLimit < 0 ? "unlimited seats" : `${seatLimit} seats in total, including the owner`}.
            </Text>
            {error ? <Alert color="red">{error}</Alert> : null}
            <Button onClick={enableTeam} w="fit-content">Enable Team</Button>
          </Stack>
        </SectionPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <PageHeader title="Team" subtitle="One account, one role. Invite assigns admin or member." />
      <SectionPanel title="Invite member">
        <form action={invite}>
          <Group align="flex-end" grow>
            <TextInput name="email" type="email" required placeholder="Email" />
            <NativeSelect
              name="role"
              data={[
                { value: "member", label: "Member" },
                { value: "admin", label: "Admin" },
              ]}
            />
            <Button type="submit">Invite</Button>
          </Group>
        </form>
        {error ? (
          <Alert color="red" mt="md">
            {error}
          </Alert>
        ) : null}
        {url ? (
          <Text size="sm" mt="md">
            Invite link:{" "}
            <Anchor href={url} c="leadely" fw={600} underline="always">
              {url}
            </Anchor>
          </Text>
        ) : null}
      </SectionPanel>
      <SectionPanel title="Members" padded={false}>
        <div className={classes.tableWrap}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Member</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {members.map((member) => (
                <Table.Tr key={member.email}>
                  <Table.Td>
                    <EntityRow title={member.displayName || member.email} subtitle={member.email} initials={(member.displayName || member.email).slice(0, 2).toUpperCase()} />
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={member.role === "owner" ? "leadely" : member.role === "admin" ? "blue" : "gray"}>
                      {member.role}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {member.role === "owner" ? null : (
                      <Group gap="xs">
                        {viewerRole === "owner" ? (
                          <>
                            <form action={async (formData) => { await setMemberRoleAction(formData); }}>
                              <input type="hidden" name="userId" value={member.userId} />
                              <input type="hidden" name="role" value={member.role === "admin" ? "member" : "admin"} />
                              <Button type="submit" variant="subtle" size="compact-sm">
                                Make {member.role === "admin" ? "member" : "admin"}
                              </Button>
                            </form>
                            <form action={async (formData) => { await transferOwnerAction(formData); }}>
                              <input type="hidden" name="userId" value={member.userId} />
                              <Button type="submit" variant="subtle" size="compact-sm">
                                Make owner
                              </Button>
                            </form>
                          </>
                        ) : null}
                        <form action={async (formData) => { await removeMemberAction(formData); }}>
                          <input type="hidden" name="userId" value={member.userId} />
                          <Button type="submit" variant="subtle" color="red" size="compact-sm">
                            Remove
                          </Button>
                        </form>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </SectionPanel>
    </Stack>
  );
}
