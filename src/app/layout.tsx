import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { EmailProvider } from "@/contexts/email-context";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "mailie_",
  description: "Minimal brutalist email client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistMono.variable} font-mono antialiased h-screen overflow-hidden`}>
        <AuthProvider>
          <EmailProvider>
            {children}
            <Toaster />
          </EmailProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
