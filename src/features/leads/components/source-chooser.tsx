"use client";

import { useState, useTransition } from "react";
import { Badge, Box, Combobox, Group, InputBase, Loader, ScrollArea, Text, ThemeIcon, useCombobox } from "@mantine/core";
import { Check, DatabaseZap, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function SourceChooser({ sources, selectedId }: { sources: { id: string; title: string }[]; selectedId: string }) {
  const router = useRouter();
  const t = useTranslations("Scrape");
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const combobox = useCombobox({
    onDropdownOpen: () => combobox.focusSearchInput(),
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      combobox.focusTarget();
      setSearch("");
    },
  });
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  const matches = sources.filter((source) => normalize(source.title).includes(normalize(search.trim())));
  const selected = sources.find((source) => source.id === selectedId);

  return <Box
    p={{ base: "sm", sm: "md" }}
    style={{
      border: "1px solid var(--mantine-color-teal-3)",
      borderRadius: 14,
      background: "linear-gradient(135deg, var(--mantine-color-teal-0) 0%, var(--mantine-color-white) 62%)",
      boxShadow: "0 8px 24px rgba(0, 120, 90, 0.06)",
    }}
  >
    <Group justify="space-between" align="flex-start" mb="sm" gap="sm" wrap="wrap">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size={38} radius="md" variant="filled" color="teal"><DatabaseZap size={19} /></ThemeIcon>
        <Box>
          <Text fw={700} size="sm">{t("installedSource")}</Text>
          <Text size="xs" c="dimmed">{t("sourceDescription")}</Text>
        </Box>
      </Group>
      <Badge variant="light" color="teal">{t("installedCount", { count: sources.length })}</Badge>
    </Group>
    <Combobox store={combobox} onOptionSubmit={(id) => {
      combobox.closeDropdown();
      if (id !== selectedId) startTransition(() => router.push(`/app/leads/scrape/new?source=${encodeURIComponent(id)}`));
    }}>
      <Combobox.Target>
        <InputBase
          component="button"
          type="button"
          pointer
          rightSection={pending ? <Loader size={16} /> : <Combobox.Chevron />}
          rightSectionPointerEvents="none"
          disabled={pending}
          onClick={() => combobox.toggleDropdown()}
          styles={{ input: { minHeight: 54, height: "auto", borderColor: "var(--mantine-color-teal-4)", background: "var(--mantine-color-white)", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)" } }}
        >
          <Box py={7} ta="left">
            <Text size="xs" c="teal" fw={650}>Selected source</Text>
            <Text size="sm" fw={700}>{selected?.title || t("chooseSource")}</Text>
          </Box>
        </InputBase>
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Search value={search} placeholder={t("searchSources")} aria-label={t("searchSources")}
          leftSection={<Search size={16} />} onChange={(event) => {
            setSearch(event.currentTarget.value);
            combobox.resetSelectedOption();
          }} />
        <Text size="xs" c="dimmed" px="sm" py={8}>{matches.length} / {t("installedCount", { count: sources.length })}</Text>
        <Combobox.Options>
          <ScrollArea.Autosize mah={260} type="auto">
            {matches.length ? matches.map((source) => <Combobox.Option key={source.id} value={source.id} active={source.id === selectedId}>
              <Group gap="xs" wrap="nowrap">
                <Check size={14} style={{ flexShrink: 0, visibility: source.id === selectedId ? "visible" : "hidden" }} />
                <Text size="sm">{source.title}</Text>
              </Group>
            </Combobox.Option>) : <Combobox.Empty>{t("noSourceMatch")}</Combobox.Empty>}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  </Box>;
}
