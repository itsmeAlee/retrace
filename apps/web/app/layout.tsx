import "./globals.css";

export const metadata = {
  title: "Retrace App",
  description: "Retrace web app"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
