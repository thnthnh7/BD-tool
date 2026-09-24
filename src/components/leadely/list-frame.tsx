import { Box, Button, Group, Text, TextInput } from "@mantine/core";
import type { ReactNode } from "react";
import { LinkAnchor, LinkButton } from "@/components/mantine-link";
import classes from "@/styles/leadely-dashboard.module.css";

export function ListSearch({
  path,
  q,
  placeholder,
  name = "q",
  extra,
}: {
  path: string;
  q: string;
  placeholder: string;
  name?: string;
  extra?: Record<string, string>;
}) {
  return (
    <form action={path}>
      {Object.entries(extra || {})
        .filter(([, value]) => value)
        .map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      <Group gap="xs" wrap="nowrap">
        <TextInput name={name} defaultValue={q} placeholder={placeholder} aria-label={placeholder} w={300} />
        <Button type="submit" variant="light">
          Search
        </Button>
        {q ? (
          <LinkAnchor href={listHref(path, "", 1, name, extra)} size="sm">
            Xóa
          </LinkAnchor>
        ) : null}
      </Group>
    </form>
  );
}

export function ListFooter({
  path,
  q,
  page,
  pageCount,
  from,
  to,
  total,
  singular,
  plural,
  name = "q",
  extra,
  note,
}: {
  path: string;
  q: string;
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  singular: string;
  plural: string;
  name?: string;
  extra?: Record<string, string>;
  note?: string;
}) {
  const range = pageCount > 1 ? `${from}–${to} của ${total}` : `${total} ${total === 1 ? singular : plural}`;
  return (
    <Group justify="space-between" px="md" py="sm">
      <Text size="sm" c="dimmed">
        {note ? `${range} · ${note}` : range}
      </Text>
      {pageCount > 1 ? (
        <Group gap={4} wrap="nowrap">
          {pageLinks(page, pageCount).map((item, index) =>
            item === "…" ? (
              <Text key={`gap-${index}`} size="sm" c="dimmed" px={4}>
                …
              </Text>
            ) : (
              <LinkButton key={item} href={listHref(path, q, item, name, extra)} size="compact-sm" variant={item === page ? "filled" : "subtle"} color={item === page ? "leadely" : "gray"}>
                {item}
              </LinkButton>
            ),
          )}
        </Group>
      ) : null}
    </Group>
  );
}

export function ListTable({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <>
      <Box className={classes.scrollTable}>
        {children}
      </Box>
      {footer}
    </>
  );
}

export function listHref(path: string, q: string, page: number, name = "q", extra?: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extra || {})) {
    if (value) params.set(key, value);
  }
  if (q) params.set(name, q);
  const pageKey = name === "q" ? "page" : `${name}Page`;
  if (page > 1) params.set(pageKey, String(page));
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

function pageLinks(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const end = Math.min(total, Math.max(current + 2, 5));
  const start = Math.max(1, end - 4);
  const items: Array<number | "…"> = [];
  if (start > 1) items.push(1, "…");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total) items.push("…", total);
  return items;
}
