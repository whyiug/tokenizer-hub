import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tokenizer Hub",
  description: "A minimal tokenizer workbench for modern AI models.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
