import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { BodyTabs } from "@/components/BodyTabs";
import { SearchBar } from "@/components/SearchBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "PDX Vote Explorer",
  description: "Transparent Portland City Council voting records.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <nav className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-pdx-blue shrink-0">
              <Image src="/portland-flag.svg" alt="" width={28} height={17} priority />
              PDX VOTE EXPLORER
            </h1>
            <BodyTabs />
            <SearchBar />
          </nav>
        </header>
        <main className="max-w-7xl mx-auto p-4 flex-1 w-full">{children}</main>
        <footer className="border-t border-gray-200 py-6">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-sm text-gray-500">
            <span>Free and open civic data. No paywall, ever.</span>
            <span className="flex items-center gap-4">
              <Link href="/how-it-works" className="font-semibold text-pdx-blue hover:underline">
                How It Works
              </Link>
              <Link href="/about" className="font-semibold text-pdx-blue hover:underline">
                Our Ethos
              </Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
