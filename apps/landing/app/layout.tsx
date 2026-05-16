import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata = {
  title: "Retrace | The Modern Scholar's Companion",
  description: "Capture what matters while you browse. Resume exactly where you left off. The digital ink for the deep worker.",
  openGraph: {
    title: "Retrace | The Modern Scholar's Companion",
    description: "Capture what matters while you browse. Resume exactly where you left off.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`scroll-smooth ${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans bg-background text-text-primary selection:bg-secondary/30 antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
