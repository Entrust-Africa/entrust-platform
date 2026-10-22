// Google Analytics integration for Next.js (app directory)
'use client';
import Script from 'next/script';

export default function Analytics() {
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX`}
      strategy="afterInteractive"
    />
  );
}

// Add this to your layout.tsx (inside <body>):
// <Analytics />
// Replace G-XXXXXXXXXX with your actual Google Analytics Measurement ID.
