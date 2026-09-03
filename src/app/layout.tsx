import type { Metadata } from "next";
import { Noto_Sans_Arabic, Geist_Mono } from "next/font/google";
import "./globals.css";

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-geist-sans",
  subsets: ["arabic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Leapin",
  description: "منصة تراخيص وتأسيس الشركات للمستثمرين الأجانب",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${notoSansArabic.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
