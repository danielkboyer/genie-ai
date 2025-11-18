import type { Metadata } from "next";
import { Inter, Luckiest_Guy } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const luckiestGuy = Luckiest_Guy({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-comic",
});

export const metadata: Metadata = {
  title: "The Secret Word - Word Guessing Game",
  description: "Guess the daily word by asking yes or no questions",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${luckiestGuy.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
