import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BENCHMARK SMID",
  description:
    "Benchmark de inteligencia publicitaria: temáticas, SOV e inversión estimada de la competencia.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--line)] bg-[var(--paper)]/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-sm font-semibold tracking-[0.12em] uppercase">
              Benchmark SMID
            </Link>
            <nav className="flex gap-4 text-sm text-[var(--muted)]">
              <Link href="/nuevo" className="hover:text-[var(--ink)]">
                Nuevo análisis
              </Link>
              <Link href="/" className="hover:text-[var(--ink)]">
                Inicio
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
