import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import CurtainPreloader from "@/components/react-bits/curtain-preloader";
import { ToasterLazy } from "@/components/ui/toaster-lazy";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/jsonld";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  display: "swap",
  adjustFontFallback: true,
  preload: true,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sandryne Boutique — We Curate Elegance",
    template: "%s | Sandryne Boutique",
  },
  description:
    "A curated luxury fashion boutique. Timeless silhouettes, modern minimalism, effortless elegance — dresses, tops, bottoms, active wear, accessories and jewelry.",
  applicationName: "Sandryne Boutique",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  keywords: [
    "luxury fashion boutique",
    "women's designer clothing",
    "curated fashion",
    "silk dresses",
    "minimalist wardrobe",
    "elevated basics",
    "gold vermeil jewelry",
    "Sandryne Boutique",
  ],
  openGraph: {
    siteName: "Sandryne Boutique",
    type: "website",
    url: siteUrl,
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Sandryne Boutique" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sandryne Boutique — We Curate Elegance",
    description:
      "A curated luxury fashion boutique. Timeless silhouettes, modern minimalism, effortless elegance.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <script
          // Runs synchronously before first paint: shows the curtain preloader
          // only on the first visit of a session, and flags JS availability so
          // scroll-reveal text can stay visible for no-JS visitors.
          dangerouslySetInnerHTML={{
            __html:
              "(function(){document.documentElement.setAttribute('data-js','');try{if(!sessionStorage.getItem('sandryne_seen'))document.documentElement.setAttribute('data-preloader','show')}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <CurtainPreloader />
        <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
        {children}
        <ToasterLazy />
      </body>
    </html>
  );
}
