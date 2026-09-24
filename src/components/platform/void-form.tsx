"use client";

export function VoidForm({
  action,
  children,
}: {
  action: (formData: FormData) => Promise<unknown>;
  children: React.ReactNode;
}) {
  return (
    <form
      action={async (formData) => {
        await action(formData);
      }}
    >
      {children}
    </form>
  );
}
