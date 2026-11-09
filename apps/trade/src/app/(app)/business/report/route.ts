import { headers } from "next/headers";

const FORMATS = new Set(["csv", "xlsx", "pdf"]);

/** A business's own report as a PDF, Excel or CSV file. The API checks that the caller can see the business; this only passes the file on. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId") ?? "";
  const format = FORMATS.has(searchParams.get("format") ?? "") ? searchParams.get("format")! : "pdf";
  const cookie = (await headers()).get("cookie") ?? "";
  const response = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/v1/trade/reports/smes/${encodeURIComponent(organizationId)}/export?format=${format}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!response.ok) return new Response("You can't download this report.", { status: response.status });
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": response.headers.get("content-disposition") ?? `attachment; filename="business-report.${format}"`,
    },
  });
}
