import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "直播提词助手",
  description: "本地大屏 SKU 提词卡片",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
