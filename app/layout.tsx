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
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
