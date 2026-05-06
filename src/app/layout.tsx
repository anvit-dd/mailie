import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { EmailProvider } from "@/contexts/email-context";
import { ThemeProvider } from "@/contexts/theme-context";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "mailie_",
  description: "Minimal email client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistMono.variable} font-mono antialiased h-screen overflow-hidden`}>
        <ThemeProvider>
          <AuthProvider>
            <EmailProvider>
              {children}
              <Toaster />
            </EmailProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
