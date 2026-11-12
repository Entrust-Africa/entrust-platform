import Image from "next/image";
import Link from "next/link";
import { CONTACT, FOOTER_LINKS, IMG } from "../../lib/site";
import { PatchworkBand } from "./Decor";

export function SiteFooter() {
  return (
    <footer className="shell mt-[72px] flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-4">
          <Link href="/" aria-label="Entrust Africa, home" className="relative block h-9 w-[169px] md:h-11 md:w-[206px]">
            <Image src={IMG.logo} alt="Entrust Africa" fill sizes="206px" className="object-contain object-left" />
          </Link>
          <p className="text-base text-muted">Driving trade, investment and SME growth across Africa.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-6">
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="link-grow w-fit text-sm font-medium text-ink transition-colors hover:text-brand"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <PatchworkBand />
      <div className="flex flex-col justify-between gap-2 text-sm text-muted md:flex-row">
        <span>
          {CONTACT.city} ·{" "}
          <a href={CONTACT.phoneHref} className="transition-colors hover:text-brand">
            {CONTACT.phone}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${CONTACT.email}`} className="transition-colors hover:text-brand">
            {CONTACT.email}
          </a>
        </span>
        <span>© {new Date().getFullYear()} Entrust Africa</span>
      </div>
    </footer>
  );
}
