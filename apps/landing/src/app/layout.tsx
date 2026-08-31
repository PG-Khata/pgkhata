import type { Metadata } from "next";
import { Inter } from "next/font/google";
import StructuredData from "@/components/StructuredData";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "PGKhata - Free PG Management Software",
    template: "%s | PGKhata",
  },
  description:
    "Manage your PG properties, tenants, and billing completely free. WhatsApp notifications, police verification, expense tracking, and more.",
  keywords: [
    "PG management software",
    "paying guest management",
    "free PG software",
    "tenant management",
    "rent collection",
    "WhatsApp notifications",
  ],
  authors: [{ name: "PGKhata" }],
  creator: "PGKhata",
  metadataBase: new URL("https://pgkhata.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://pgkhata.com",
    siteName: "PGKhata",
    title: "PGKhata - Free PG Management Software",
    description:
      "Manage your PG properties, tenants, and billing completely free.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PGKhata - Free PG Management Software",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PGKhata - Free PG Management Software",
    description:
      "Manage your PG properties, tenants, and billing completely free.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="canonical" href="https://pgkhata.com" />
      </head>
      <body className="font-sans antialiased">
        <StructuredData />
        {children}
      </body>
    </html>
  );
}
