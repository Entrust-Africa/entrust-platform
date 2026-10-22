import Link from "next/link";
import FadeInSection from "../../components/FadeInSection";
import Image from "next/image";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";

interface PlatformCardProps {
  logo: string;
  alt: string;
  title: string;
  description: string;
  href: string;
  cta?: string;
  comingSoon?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function PlatformCard({
  logo,
  alt,
  title,
  description,
  href,
  cta = "Visit platform",
  comingSoon = false,
  fullWidth = false,
  className,
}: PlatformCardProps) {
  return (
    <FadeInSection>
      <Link
        href={href}
        className={clsx(
          "platform-card gateway-hm-platform-link group relative flex h-full w-full flex-col items-center rounded-2xl border border-zinc-200/90 bg-white px-5 py-6 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-lg",
          "ea-card-stack no-underline decoration-transparent",
          "text-inherit visited:text-inherit hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#19954f]/45 focus-visible:ring-offset-2",
          fullWidth && "w-full max-w-none",
          comingSoon && "ring-1 ring-emerald-100",
          className,
        )}
        aria-label={`${cta}: ${title}`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem' }}
      >
        {comingSoon ? (
          <span className="absolute right-3 top-3 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900 ring-1 ring-emerald-200/80">
            Coming soon
          </span>
        ) : null}
        <div className="ea-card-media flex h-[6.75rem] w-[6.75rem] shrink-0 items-center justify-center rounded-2xl bg-white shadow-inner mb-2">
          <Image 
            src={logo} 
            alt={alt} 
            width={92} 
            height={56} 
            className="object-contain rounded-md bg-white" 
            style={{ width: '92px', height: '56px', objectFit: 'contain', borderRadius: '0.5rem', background: '#fff' }} 
            sizes="92px" 
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0 items-center">
          <h3 className="ea-card-title max-w-[20ch] transition-colors group-hover:text-[#19954f] mb-1">{title}</h3>
          <p className="ea-card-body flex-1 text-pretty transition-colors group-hover:text-zinc-800 mb-2">
            {description}
          </p>
          <span
            className="ea-card-cta mt-1 inline-flex min-h-9 min-w-[6.7rem] items-center justify-center gap-2 rounded-xl bg-[#19954f] px-3 font-[family-name:var(--font-heading)] font-semibold text-white transition hover:bg-[#157642]"
            style={{ fontSize: '0.93rem', lineHeight: 1.2 }}
          >
            {cta}
            <ArrowRight size={16} aria-hidden className="transition group-hover:translate-x-0.5 align-middle" style={{ verticalAlign: 'middle', marginBottom: '2px' }} />
          </span>
        </div>
      </Link>
    </FadeInSection>
  );
}
