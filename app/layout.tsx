import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import ThemeBootstrap from "@/components/ThemeBootstrap";
import { INLINE_BOOT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "直播提词助手",
  description: "本地大屏 SKU 提词卡片",
  applicationName: "直播提词助手",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "提词助手",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INLINE_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <ThemeBootstrap />
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
