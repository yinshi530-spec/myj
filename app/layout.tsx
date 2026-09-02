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
  title: '猫游记 · 道具强化测试',
  description: '按猫游记官方“概率公示Ⅱ”复现燃烧宝石与星月神话的强化等级变化。',
  openGraph: {
    title: '猫游记 · 道具强化测试',
    description: '燃烧宝石 × 星月神话｜官方概率规则',
    images: [{ url: '/maoyouji-official-bg.jpg', alt: '猫游记官方视觉' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '猫游记 · 道具强化测试',
    description: '燃烧宝石 × 星月神话｜官方概率规则',
    images: ['/maoyouji-official-bg.jpg'],
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
