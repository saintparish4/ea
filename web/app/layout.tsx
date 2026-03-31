import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import { Providers } from "@/app/providers/providers";
import { SideNav } from "@/app/components/sideNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Ea Wallet",
  description: "Chain-agnostic reference wallet powered by Ea plugin runtime",
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <SideNav />
            <main className="flex-1 p-6 lg:p-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
