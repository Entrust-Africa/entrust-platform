import { headers } from "next/headers";

/** The submitted diagnostics as a CSV file. The API checks that the caller is Entrust staff; this only passes the file on. */
export async function GET() {
  const cookie = (await headers()).get("cookie") ?? "";
  const response = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/v1/trade/public-diagnostics/export.csv`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!response.ok) return new Response("You can't export the diagnostics.", { status: response.status });
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "text/csv; charset=utf-8",
      "Content-Disposition": response.headers.get("content-disposition") ?? 'attachment; filename="onboarding-diagnostics.csv"',
    },
  });
}
