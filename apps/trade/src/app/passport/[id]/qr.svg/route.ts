import { renderSVG } from "uqr";
import { passportAddress } from "@/lib/passport";

/**
 * The QR code for a passport as an SVG, for the printed passport. It holds the address of the public page and nothing else, so
 * it works for any number: the page says whether that passport exists.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{3,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const svg = renderSVG(passportAddress(request.headers, id.toUpperCase()), { ecc: "M", border: 2 });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" } });
}
