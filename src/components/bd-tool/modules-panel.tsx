"use client";

import { useMemo, useState } from "react";
import { Button, Chip, Group, SimpleGrid, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/leadely/empty-state";
import { PageHeader } from "@/components/leadely/page-header";
import { SectionPanel } from "@/components/leadely/section-panel";
import { formatVnd } from "@/lib/money";
import { createModuleAction } from "@/lib/db/actions";
import type { ServiceModule } from "@/lib/types";

export function ModulesPanel({ initialModules, canEdit }: { initialModules: ServiceModule[]; canEdit: boolean }) {
  const [modules, setModules] = useState(initialModules);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const categories = ["All", ...Array.from(new Set(modules.map((module) => module.category)))];

  async function addModule() {
    if (!name.trim() || !canEdit) return;
    const result = await createModuleAction({ name, description, suggestedPrice: price });
    if (result.error) return;
    setModules([{ id: crypto.randomUUID(), name, description, suggestedPrice: price, category: "Product", defaultQty: 1, visualHint: "Custom module" }, ...modules]);
    setName("");
    setPrice(0);
    setDescription("");
  }

  const visible = useMemo(() => {
    return modules.filter((module) => {
      const matchesCategory = category === "All" || module.category === category;
      const matchesQuery = !query.trim() || `${module.name} ${module.description}`.toLowerCase().includes(query.trim().toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [modules, category, query]);

  return (
    <Stack gap="md">
      <PageHeader title="Modules" subtitle="Suggested catalog. Prices stay fully editable inside each quote." />
      {canEdit ? (
        <SectionPanel title="Add module">
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput label="Module name" placeholder="Module name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
              <TextInput label="Suggested price" type="number" value={price} onChange={(event) => setPrice(Number(event.currentTarget.value))} />
            </SimpleGrid>
            <Textarea label="Description" placeholder="Description" minRows={3} value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
            <Button onClick={addModule} w="fit-content">
              Add module
            </Button>
          </Stack>
        </SectionPanel>
      ) : null}

      <SectionPanel>
        <Group gap="sm" align="center">
          <TextInput placeholder="Search catalog" value={query} onChange={(event) => setQuery(event.currentTarget.value)} w={260} />
          <Chip.Group multiple={false} value={category} onChange={setCategory}>
            <Group gap="xs">
              {categories.map((item) => (
                <Chip key={item} value={item} size="sm" variant="outline">
                  {item}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Group>
      </SectionPanel>

      {visible.length === 0 ? (
        <SectionPanel>
          <EmptyState
            icon={<PackageSearch size={18} />}
            title="No modules match"
            description="Đổi từ khóa tìm kiếm hoặc chọn danh mục khác."
          />
        </SectionPanel>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
          {visible.map((module) => (
            <SectionPanel key={module.id}>
              <Text size="xs" c="dimmed" fw={600}>
                {module.category}
              </Text>
              <Text fw={700} mt={4} lineClamp={2}>
                {module.name}
              </Text>
              <Text size="sm" c="dimmed" mt={4} lineClamp={3}>
                {module.description}
              </Text>
              <Text fw={700} mt="auto" pt="md" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatVnd(module.suggestedPrice)}
              </Text>
            </SectionPanel>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
