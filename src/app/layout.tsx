import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "INNOVA Hire", template: "%s · INNOVA Hire" },
  description: "Technical assessments for structural engineering candidates.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
