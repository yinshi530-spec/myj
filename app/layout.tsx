import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '猫游记 · 道具工坊',
  description: '燃烧宝石与星月神话的道具升级交互 Mock，支持成功、失败、概率和资源消耗测试。',
  openGraph: {
    title: '猫游记 · 道具工坊',
    description: '燃烧宝石 × 星月神话｜升级 Mock',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '猫游记道具工坊社交预览图' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '猫游记 · 道具工坊',
    description: '燃烧宝石 × 星月神话｜升级 Mock',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
