import type { Metadata } from "next";
import { fontSans, fontMono } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComputeGrid — open price feed for the GPU spot market",
  description:
    "Real-time aggregate of GPU pricing and availability across compute providers. For agents and the humans they work for.",
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
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
