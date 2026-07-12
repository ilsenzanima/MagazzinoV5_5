import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Lexend } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { ConnectionManager } from "@/components/ConnectionManager";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false, // usato solo in pagine specifiche (report, tagliatrice, ecc.), non in ogni pagina
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false, // font opzionale, usato solo se selezionato nelle impostazioni
});

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  preload: false, // font opzionale, usato solo se selezionato nelle impostazioni
});

export const metadata: Metadata = {
  title: "Magazzino V5.5",
  description: "Gestione Magazzino Intelligente",
  manifest: "/manifest.json",
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Magazzino',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${lexend.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          themes={["light", "dark", "gray", "system"]}
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ConnectionManager />
            <ServiceWorkerRegistration />
            {children}
            <Toaster />
            <SonnerToaster richColors position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
