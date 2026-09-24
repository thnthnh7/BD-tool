import { Stack, Text, TextInput } from "@mantine/core";
import { Table, TableThead, TableTbody, TableTr, TableTh, TableTd } from "@/components/leadely/table";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { AccountControls, RevokeInviteButton } from "@/components/platform/account-controls";
import { requirePlatform } from "@/lib/auth/session";
import { loadPlatformAccounts } from "@/lib/platform/ops";
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
                <TableTh>Status</TableTh>
                <TableTh>Last sign-in</TableTh>
                <TableTh />
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
                  <TableTd>{account.status}</TableTd>
                  <TableTd>{account.lastSignIn ? new Date(account.lastSignIn).toLocaleString() : "—"}</TableTd>
                  <TableTd>
                    {superAdmin || account.role === "owner" || account.role === "admin" || account.role === "member" || account.role === "onboarding" ? (
                      <AccountControls
                        userId={account.id}
                        email={account.email}
                        status={account.status}
                        role={account.role}
                        canMutate={superAdmin}
                      />
                    ) : null}
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
        </div>
      </SectionPanel>
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
              {data.platformInvites.map((invite) => (
                <TableTr key={invite.id}>
                  <TableTd>{invite.email}</TableTd>
                  <TableTd>{invite.role}</TableTd>
                  <TableTd>{superAdmin ? <RevokeInviteButton id={invite.id} kind="platform" /> : null}</TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
        </div>
      </SectionPanel>
    </Stack>
  );
}
