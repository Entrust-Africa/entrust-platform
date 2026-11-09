import { headers } from "next/headers";

const FORMATS = new Set(["csv", "xlsx", "pdf"]);

/** A programme or cohort report as a CSV, Excel or PDF file, narrowed by the same filters as the page. The API checks that the caller is Entrust staff; this only passes the file on. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") === "program" ? "programs" : "cohorts";
  const id = searchParams.get("id") ?? "";
  const format = FORMATS.has(searchParams.get("format") ?? "") ? searchParams.get("format")! : "xlsx";
  const query = new URLSearchParams({ format });
  for (const key of ["pathway", "moduleId", "cohortId"]) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }
  const cookie = (await headers()).get("cookie") ?? "";
  const response = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/v1/trade/reports/${kind}/${encodeURIComponent(id)}/export?${query}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!response.ok) return new Response("You can't export this report.", { status: response.status });
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": response.headers.get("content-disposition") ?? `attachment; filename="trade-report.${format}"`,
    },
  });
}
