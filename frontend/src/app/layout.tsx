import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CustomAI Studio",
  description: "Build and chat with your own AI assistants.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="dark" lang="en" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
