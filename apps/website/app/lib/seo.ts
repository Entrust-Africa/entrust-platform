import type { Metadata } from "next";

const SITE_URL = "https://entrustafrica.com";
const DEFAULT_OG_IMAGE = "/src/assets/entrust-africa-logo.jpeg";

type BuildMetadataInput = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
};

export function buildMetadata({
  title,
  description,
  path,
  type = "website",
}: BuildMetadataInput): Metadata {
  const canonicalPath = path.startsWith("/") ? path : `/${path}`;
  const absoluteUrl = `${SITE_URL}${canonicalPath}`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: absoluteUrl,
      type,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: "Entrust Africa",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}
