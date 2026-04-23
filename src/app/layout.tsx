import type { Metadata } from "next";
import { fontSans, fontMono } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComputeGrid — open price feed for the GPU spot market",
  description:
    "Real-time aggregate of GPU pricing and availability across compute providers. For agents and the humans they work for.",
  icons: {
    icon: "/favicon.svg",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "ComputeGrid",
  description:
    "Real-time open price feed aggregating GPU spot pricing and availability across multiple compute providers (RunPod, Vast.ai, Vultr).",
  keywords: [
    "GPU",
    "spot market",
    "H100",
    "A100",
    "compute pricing",
    "MCP",
    "AI infrastructure",
  ],
  license: "https://opensource.org/licenses/MIT",
  url: "https://computegrid.dev/",
  creator: {
    "@type": "Organization",
    name: "ComputeGrid",
    url: "https://github.com/sheraz-ali1/compute-centralization",
  },
  distribution: [
    {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: "/api/snapshot.json",
    },
    {
      "@type": "DataDownload",
      encodingFormat: "text/event-stream",
      contentUrl: "/api/stream",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} dark h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
