"use client";

import { useState } from "react";
import { Button, Drawer, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Plus } from "lucide-react";
import { ActionForm } from "@/features/crm/components/action-form";
import { createTaskAction } from "@/features/tasks/server/actions";
import { DEAL_PRIORITIES, TASK_TYPES } from "@/lib/crm";

type Option = { value: string; label: string };

export function TaskCreateDrawer({ companies, contacts, deals }: { companies: Option[]; contacts: Option[]; deals: Option[] }) {
  const [opened, setOpened] = useState(false);
  return <>
    <Button leftSection={<Plus size={16} />} onClick={() => setOpened(true)}>Tạo task</Button>
    <Drawer opened={opened} onClose={() => setOpened(false)} position="right" size="lg" title={<Text fw={700}>Tạo task mới</Text>}>
      <ActionForm action={createTaskAction} submitLabel="Tạo task" onSuccess={() => setOpened(false)}>
        <Stack gap="sm">
          <TextInput name="title" label="Tiêu đề" placeholder="Việc cần thực hiện" required />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NativeSelect name="type" label="Loại task" data={TASK_TYPES.map((item) => ({ value: item, label: taskTypeLabel(item) }))} />
            <NativeSelect name="priority" label="Ưu tiên" defaultValue="medium" data={DEAL_PRIORITIES.map((item) => ({ value: item, label: priorityLabel(item) }))} />
            <TextInput name="due_at" type="datetime-local" label="Thời hạn" />
            <NativeSelect name="company_id" label="Công ty" data={[{ value: "", label: "Không chọn" }, ...companies]} />
            <NativeSelect name="deal_id" label="Deal" data={[{ value: "", label: "Không chọn" }, ...deals]} />
            <NativeSelect name="contact_id" label="Liên hệ" data={[{ value: "", label: "Không chọn" }, ...contacts]} />
          </SimpleGrid>
          <Textarea name="description" label="Mô tả" minRows={4} autosize />
        </Stack>
      </ActionForm>
    </Drawer>
  </>;
}

function taskTypeLabel(value: string) {
  return ({ follow_up: "Theo dõi", call: "Cuộc gọi", email: "Email", meeting: "Cuộc họp", proposal: "Đề xuất", review: "Đánh giá", other: "Khác" } as Record<string, string>)[value] || value;
}

function priorityLabel(value: string) {
  return ({ high: "Cao", medium: "Trung bình", low: "Thấp" } as Record<string, string>)[value] || value;
}
