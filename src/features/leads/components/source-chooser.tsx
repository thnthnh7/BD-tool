"use client";

import { useState, useTransition } from "react";
import { Combobox, Group, InputBase, Loader, ScrollArea, Text, useCombobox } from "@mantine/core";
import { Check, Search } from "lucide-react";
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

  return <Combobox store={combobox} onOptionSubmit={(id) => {
    combobox.closeDropdown();
    if (id !== selectedId) startTransition(() => router.push(`/app/leads/scrape/new?source=${encodeURIComponent(id)}`));
  }}>
    <Combobox.Target>
      <InputBase component="button" type="button" pointer label={t("installedSource")}
        description={t("sourceDescription")}
        rightSection={pending ? <Loader size={14} /> : <Combobox.Chevron />} rightSectionPointerEvents="none"
        disabled={pending} onClick={() => combobox.toggleDropdown()}>
        {selected?.title || t("chooseSource")}
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
  </Combobox>;
}
