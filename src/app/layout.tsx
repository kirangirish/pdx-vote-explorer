import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import { Search } from "lucide-react";
import { BodyTabs } from "@/components/BodyTabs";
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
      <body className="antialiased bg-gray-50 text-gray-900">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-pdx-blue shrink-0">
              <Image src="/portland-flag.svg" alt="" width={28} height={17} priority />
              PDX VOTE EXPLORER
            </h1>
            <BodyTabs />
            <div className="relative hidden sm:block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search issues, votes, members..."
                className="border border-gray-300 rounded-full pl-9 pr-4 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-pdx-blue/30 focus:border-pdx-blue transition"
              />
            </div>
          </nav>
        </header>
        <main className="max-w-7xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
