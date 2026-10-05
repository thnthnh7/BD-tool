"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { updatePlanConfigurationAction } from "@/lib/platform/actions";

const PlanSaveContext = createContext(false);

export function PlanConfigurationForm({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);

  async function save(formData: FormData) {
    setPending(true);
    try {
      const result = await updatePlanConfigurationAction(formData);
      if (result && "error" in result && result.error) {
        const partial = "partial" in result && result.partial === true;
        notifications.show({
          color: partial ? "yellow" : "red",
          title: partial ? "Pricing was not synchronized" : "Plan was not saved",
          message: result.error,
        });
        return;
      }
      notifications.show({
        color: "teal",
        title: "Plan saved",
        message: result && "message" in result ? result.message : "Plan settings were saved successfully.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Plan was not saved",
        message: error instanceof Error ? error.message : "An unexpected error occurred while saving the plan.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <PlanSaveContext.Provider value={pending}>
      <form action={save} aria-busy={pending}>
        {children}
      </form>
    </PlanSaveContext.Provider>
  );
}

export function PlanSaveButton() {
  const pending = useContext(PlanSaveContext);
  return (
    <Button type="submit" loading={pending} disabled={pending}>
      {pending ? "Saving…" : "Save plan"}
    </Button>
  );
}
