/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  distDir: ".next",
  // Pages from the old site (Gateway, Andinet, Entrust sub-pages) now live on the new pages; Afri-Bridge was retired.
  async redirects() {
    return [
      { source: "/GatwayHome", destination: "/", permanent: true },
      { source: "/andinet", destination: "/entrust#andinet", permanent: true },
      { source: "/andinet/events", destination: "/events", permanent: true },
      { source: "/andinet/community", destination: "/community", permanent: true },
      { source: "/andinet/partners", destination: "/partners", permanent: true },
      { source: "/andinet/contact", destination: "/contact", permanent: true },
      { source: "/andinet/:path*", destination: "/entrust#andinet", permanent: true },
      { source: "/afri-bridge/contact", destination: "/contact", permanent: true },
      { source: "/afri-bridge/:path*", destination: "/entrust", permanent: true },
      { source: "/entrust/about", destination: "/about", permanent: true },
      { source: "/entrust/services", destination: "/entrust#services", permanent: true },
      { source: "/entrust/experience", destination: "/entrust#track-record", permanent: true },
      { source: "/entrust/contact", destination: "/contact", permanent: true },
    ];
  },
};

module.exports = nextConfig;
