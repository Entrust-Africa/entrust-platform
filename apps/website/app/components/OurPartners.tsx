"use client";

import Image from "next/image";
import { PARTNER_LOGO_PATHS } from "../constants/partners";

type Props = {
  logos?: string[];
  heading?: string;
  subtext?: string;
};

const defaultLogos = [...PARTNER_LOGO_PATHS];

export default function OurPartners({
  logos = defaultLogos,
  heading = "Our Partners",
  subtext = "Organizations we collaborate with",
}: Props) {
  const uniqueLogos = Array.from(new Set(logos));
  const animatedLogos = [...uniqueLogos, ...uniqueLogos];

  return (
    <section className="partners-section">
      <div className="partners-inner">
        <div className="partners-heading-group">
          <h2 className="partners-heading">{heading}</h2>
          <p className="partners-subtext">{subtext}</p>
          <p className="partners-action">Trusted partners across our regional ecosystem.</p>
        </div>

        <div className="partners-track-wrap">
          <div className="partners-track" aria-label="Partner logos">
            {animatedLogos.map((src, i) => {
              const isBalbbiys = src.includes('partner7.jpeg');
              return (
                <div key={src + "-" + i} className="partner-card">
                  <div className="partner-card-inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Image
                      src={src}
                      alt={`Partner ${((i % uniqueLogos.length) || 0) + 1}`}
                      width={220}
                      height={70}
                      className="partner-logo"
                      priority={false}
                    />
                    {isBalbbiys && (
                      <span style={{ marginTop: 6, fontSize: 14, fontWeight: 500, color: '#222', textAlign: 'center', wordBreak: 'break-word' }}>
                        BALBBIYS Trading PLC
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
