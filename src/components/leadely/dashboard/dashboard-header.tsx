"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon, Combobox, Group, Indicator, Menu, ScrollArea, Stack, Text, TextInput, useCombobox } from "@mantine/core";
import { Bell, Plus, Search } from "lucide-react";
import { LinkButton } from "@/components/mantine-link";
import { markNotificationReadAction } from "@/features/comms/server/actions";
import classes from "@/styles/leadely-dashboard.module.css";
import type { DashboardNotification, SearchTarget } from "./types";
import { relativeTime } from "./period";

const SEARCH_TARGETS: SearchTarget[] = [
  { label: "Dashboard", href: "/app", keywords: "home overview" },
  { label: "Maps scrape", href: "/app/leads/scrape", keywords: "maps google places find scrape" },
  { label: "Leads", href: "/app/leads", keywords: "lead prospect" },
  { label: "Lists", href: "/app/lists", keywords: "list csv excel" },
  { label: "Companies", href: "/app/companies", keywords: "company account" },
  { label: "Contacts", href: "/app/contacts", keywords: "people contact" },
  { label: "Deals", href: "/app/deals", keywords: "deal pipeline opportunity" },
  { label: "Tasks", href: "/app/tasks", keywords: "task today follow" },
  { label: "Quotes", href: "/app/quotes", keywords: "quote proposal" },
  { label: "New quote", href: "/app/quotes/new", keywords: "create quote brief ai" },
  { label: "Modules", href: "/app/modules", keywords: "module catalog" },
  { label: "Inbox", href: "/app/inbox", keywords: "email inbox" },
  { label: "Calendar", href: "/app/calendar", keywords: "meeting calendar" },
  { label: "Sequences", href: "/app/sequences", keywords: "sequence outreach" },
  { label: "Billing", href: "/app/billing", keywords: "plan quota usage" },
  { label: "Settings", href: "/app/settings", keywords: "workspace settings ai" },
];

export function DashboardHeader({
  greeting,
  subtitle,
  notifications,
}: {
  greeting: string;
  subtitle: string;
  notifications: DashboardNotification[];
}) {
  const router = useRouter();
  const combobox = useCombobox();
  const [query, setQuery] = useState("");
  const unread = notifications.filter((item) => !item.readAt).length;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SEARCH_TARGETS.slice(0, 6);
    return SEARCH_TARGETS.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [query]);

  return (
    <div className={classes.header} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "nowrap" }}>
      <div style={{ minWidth: 0 }}>
        <div className={classes.greeting}>{greeting}</div>
        <div className={classes.subtitle}>{subtitle}</div>
      </div>
      <Group gap={10} wrap="nowrap" visibleFrom="md" style={{ flexShrink: 0 }}>
        <Combobox
          store={combobox}
          onOptionSubmit={(href) => {
            setQuery("");
            combobox.closeDropdown();
            router.push(href);
          }}
        >
          <Combobox.Target>
            <TextInput
              className={classes.search}
              placeholder="Search companies, leads, deals..."
              leftSection={<Search size={16} />}
              value={query}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                combobox.openDropdown();
              }}
              onFocus={() => combobox.openDropdown()}
              onClick={() => combobox.openDropdown()}
              onBlur={() => combobox.closeDropdown()}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const href = matches[0]?.href;
                if (!href) return;
                setQuery("");
                combobox.closeDropdown();
                router.push(href);
              }}
            />
          </Combobox.Target>
          <Combobox.Dropdown>
            <Combobox.Options>
              {matches.length ? (
                matches.map((item) => (
                  <Combobox.Option value={item.href} key={item.href}>
                    {item.label}
                  </Combobox.Option>
                ))
              ) : (
                <Combobox.Empty>No matching pages</Combobox.Empty>
              )}
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>

        <Menu shadow="md" width={320} position="bottom-end">
          <Menu.Target>
            <Indicator disabled={!unread} color="leadely" size={8} offset={6}>
              <ActionIcon variant="default" color="gray" aria-label="Notifications">
                <Bell size={18} />
              </ActionIcon>
            </Indicator>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Notifications</Menu.Label>
            {notifications.length ? (
              <ScrollArea.Autosize mah={320}>
                {notifications.slice(0, 8).map((item) => (
                  <Menu.Item
                    key={item.id}
                    closeMenuOnClick={false}
                    onClick={() => {
                      if (item.readAt) return;
                      const form = new FormData();
                      form.set("id", item.id);
                      void markNotificationReadAction(form);
                    }}
                  >
                    <Stack gap={2}>
                      <Text size="sm" fw={item.readAt ? 500 : 700} lineClamp={1}>
                        {item.title}
                      </Text>
                      {item.body ? (
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {item.body}
                        </Text>
                      ) : null}
                      <Text size="xs" c="dimmed">
                        {relativeTime(item.createdAt)}
                      </Text>
                    </Stack>
                  </Menu.Item>
                ))}
              </ScrollArea.Autosize>
            ) : (
              <Menu.Item disabled>No notifications yet</Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>

        <LinkButton href="/app/quotes/new" leftSection={<Plus size={16} />} className={classes.create}>
          New quote
        </LinkButton>
      </Group>
    </div>
  );
}
