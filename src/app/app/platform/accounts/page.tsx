import { Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { AccountControls, RevokeInviteButton } from "@/components/platform/account-controls";
import { VoidForm } from "@/components/platform/void-form";
import { createPlatformInviteAction } from "@/lib/auth/actions";
import { requirePlatform } from "@/lib/auth/session";
import {
  loadPlatformAccounts,
  loadPlatformStaff,
  removePlatformAdminAction,
  revokeInviteAction,
  setPlatformRoleAction,
} from "@/lib/platform/ops";
import classes from "@/styles/leadely-surfaces.module.css";

export default async function PlatformAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const context = await requirePlatform();
  const { q } = await searchParams;
  const query = q?.trim() || "";
  const data = await loadPlatformAccounts(query);
  const superAdmin = context.platformRole === "super_admin";
  const staff = superAdmin ? await loadPlatformStaff() : null;
  return (
    <Stack gap="md">
      <PageHeader title="Accounts" subtitle="Search people, suspend logins, and revoke invites." />
      <SectionPanel title="Search">
        <form>
          <TextInput name="q" defaultValue={query} placeholder="Email" />
        </form>
      </SectionPanel>
      <SectionPanel title="People" padded={false}>
        <div className={classes.tableWrap}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Account</TableTh>
                <TableTh>Role</TableTh>
                <TableTh>Plan</TableTh>
                <TableTh>Status</TableTh>
                <TableTh>Last sign-in</TableTh>
                <TableTh style={{ textAlign: "right" }}>Actions</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {data.accounts.map((account) => (
                <TableTr key={account.id}>
                  <TableTd>
                    <Text size="sm" fw={600}>
                      {account.display_name || account.email}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {account.email}
                      {account.workspaceName ? ` · ${account.workspaceName}` : ""}
                    </Text>
                  </TableTd>
                  <TableTd>{account.role}</TableTd>
                  <TableTd>
                    {account.planName ? <>
                      <Text size="sm" fw={600}>{account.planName}</Text>
                      <Text size="xs" c={account.planDeactivatedAt ? "orange.7" : "dimmed"}>
                        {account.planDeactivatedAt ? "Deactivated" : account.planStatus}
                      </Text>
                    </> : "—"}
                  </TableTd>
                  <TableTd><Text size="sm" tt="capitalize">{account.status}</Text></TableTd>
                  <TableTd>{account.lastSignIn ? new Date(account.lastSignIn).toLocaleString() : "—"}</TableTd>
                  <TableTd>
                    {superAdmin || account.role === "owner" || account.role === "admin" || account.role === "member" || account.role === "onboarding" ? (
                      <Group justify="flex-end" wrap="nowrap">
                        <AccountControls
                          userId={account.id}
                          email={account.email}
                          status={account.status}
                          role={account.role}
                          canMutate={superAdmin}
                          workspaceId={account.workspaceId}
                          workspaceName={account.workspaceName}
                          planName={account.planName}
                          planDeactivated={Boolean(account.planDeactivatedAt)}
                        />
                      </Group>
                    ) : null}
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
        </div>
      </SectionPanel>
      {superAdmin ? (
        <SectionPanel title="Invite platform admin">
          <form action={async (formData) => {
            "use server";
            await createPlatformInviteAction(formData);
          }}>
            <Group align="flex-end" grow>
              <TextInput name="email" type="email" required label="Email" placeholder="admin@company.com" />
              <NativeSelect
                name="role"
                label="Platform role"
                data={[
                  { value: "support", label: "Support" },
                  { value: "super_admin", label: "Super admin" },
                ]}
              />
              <Button type="submit" w="fit-content">Create invite</Button>
            </Group>
          </form>
        </SectionPanel>
      ) : null}
      {staff ? (
        <SectionPanel title="Platform staff" padded={false}>
          <div className={classes.tableWrap}>
            <Table>
              <TableThead>
                <TableTr>
                  <TableTh>Account</TableTh>
                  <TableTh>Platform role</TableTh>
                  <TableTh />
                </TableTr>
              </TableThead>
              <TableTbody>
                {staff.admins.map((admin) => (
                  <TableTr key={admin.user_id}>
                    <TableTd>
                      <Text size="sm" fw={600}>{admin.displayName || admin.email}</Text>
                      {admin.displayName ? <Text size="xs" c="dimmed">{admin.email}</Text> : null}
                    </TableTd>
                    <TableTd>{admin.role === "super_admin" ? "Super admin" : "Support"}</TableTd>
                    <TableTd>
                      <Group gap="xs" justify="flex-end">
                        <VoidForm action={setPlatformRoleAction}>
                          <input type="hidden" name="userId" value={admin.user_id} />
                          <input type="hidden" name="role" value={admin.role === "super_admin" ? "support" : "super_admin"} />
                          <Button type="submit" variant="subtle" size="compact-sm">
                            Make {admin.role === "super_admin" ? "support" : "super admin"}
                          </Button>
                        </VoidForm>
                        <VoidForm action={removePlatformAdminAction}>
                          <input type="hidden" name="userId" value={admin.user_id} />
                          <Button type="submit" variant="subtle" color="red" size="compact-sm">Remove</Button>
                        </VoidForm>
                      </Group>
                    </TableTd>
                  </TableTr>
                ))}
                {staff.invites.map((invite) => (
                  <TableTr key={invite.id}>
                    <TableTd>{invite.email}</TableTd>
                    <TableTd>{invite.role === "super_admin" ? "Super admin · pending" : "Support · pending"}</TableTd>
                    <TableTd>
                      <Group justify="flex-end">
                        <VoidForm action={revokeInviteAction}>
                          <input type="hidden" name="id" value={invite.id} />
                          <input type="hidden" name="kind" value="platform" />
                          <Button type="submit" variant="subtle" color="red" size="compact-sm">Revoke</Button>
                        </VoidForm>
                      </Group>
                    </TableTd>
                  </TableTr>
                ))}
              </TableTbody>
            </Table>
          </div>
        </SectionPanel>
      ) : null}
      <SectionPanel title="Open invites" padded={false}>
        <div className={classes.tableWrap}>
          <Table>
            <TableThead>
              <TableTr>
                <TableTh>Email</TableTh>
                <TableTh>Role</TableTh>
                <TableTh />
              </TableTr>
            </TableThead>
            <TableTbody>
              {data.invites.map((invite) => (
                <TableTr key={invite.id}>
                  <TableTd>
                    {invite.email}
                    <Text size="xs" c="dimmed">
                      {invite.workspaceName}
                    </Text>
                  </TableTd>
                  <TableTd>{invite.role}</TableTd>
                  <TableTd>{superAdmin ? <RevokeInviteButton id={invite.id} kind="workspace" /> : null}</TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
        </div>
      </SectionPanel>
    </Stack>
  );
}
