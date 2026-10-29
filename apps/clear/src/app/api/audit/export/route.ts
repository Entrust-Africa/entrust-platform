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

  if (res.status === 401) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Failed to export audit log");
    return new NextResponse(errorText || "Failed to export audit log", { status: res.status });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const headers = new Headers();
  headers.set("Content-Type", "text/csv; charset=utf-8");
  headers.set("Content-Disposition", `attachment; filename="audit-log-${dateStr}.csv"`);

  const totalCount = res.headers.get("X-Total-Count");
  const truncated = res.headers.get("X-Truncated");
  if (totalCount) headers.set("X-Total-Count", totalCount);
  if (truncated) headers.set("X-Truncated", truncated);

  return new NextResponse(res.body, {
    status: 200,
    headers,
  });
}
