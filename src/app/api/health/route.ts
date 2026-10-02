import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();

  if (!hasServiceRole()) {
    return Response.json(
      { status: "unhealthy", checkedAt },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("platform_flags")
      .select("id", { count: "exact", head: true });

    if (error) throw error;

    return Response.json(
      { status: "ok", checkedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unhealthy", checkedAt },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
