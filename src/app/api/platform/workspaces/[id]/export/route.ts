import { NextResponse } from "next/server";
import { requirePlatform } from "@/lib/auth/session";
import { loadWorkspaceExport } from "@/lib/platform/ops";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requirePlatform("super_admin");
  const { id } = await context.params;
  const payload = await loadWorkspaceExport(id);
  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="workspace-${id}.json"`,
    },
  });
}
