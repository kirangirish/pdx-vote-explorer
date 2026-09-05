import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-pdx-blue">⚡ PDX VOTE EXPLORER</h1>
            <input 
              type="text" 
              placeholder="Search issues, votes, members..." 
              className="border border-gray-300 rounded-md px-3 py-1 text-sm w-64"
            />
          </nav>
        </header>
        <main className="max-w-7xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
