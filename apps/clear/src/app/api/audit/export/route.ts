import { NextRequest, NextResponse } from "next/server";
import { serverApi } from "@/lib/api";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const client = await serverApi();

  const res = await client.v1.audit.$get({
    query: {
      organizationId: search.get("organizationId") ?? undefined,
      entityType: search.get("entityType") ?? undefined,
      entityId: search.get("entityId") ?? undefined,
      action: search.get("action") ?? undefined,
      platform: (search.get("platform") as any) ?? undefined,
      from: search.get("from") ?? undefined,
      to: search.get("to") ?? undefined,
      format: "csv",
    },
  });

  if (!res.ok) {
    return new NextResponse("Failed to export audit log", { status: res.status });
  }

  const csvText = await res.text();
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(csvText, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${dateStr}.csv"`,
    },
  });
}
