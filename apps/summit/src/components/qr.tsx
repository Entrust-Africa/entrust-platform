import { renderSVG } from "uqr";

/** A QR code for an address, drawn as SVG on the server so it needs no script in the browser and prints sharply. */
export function Qr({ value, label, className = "size-44" }: { value: string; label: string; className?: string }) {
  const svg = renderSVG(value, { ecc: "M", border: 1 });
  return <div role="img" aria-label={label} className={`${className} bg-white [&>svg]:size-full`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
