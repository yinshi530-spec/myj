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
  title: '猫游记 · 天穹工坊',
  description: '覆盖官方《概率公示Ⅱ》24 组道具的强化、升阶、祈愿与重绘冒险。',
  openGraph: {
    title: '猫游记 · 天穹工坊',
    description: '24 组官方公示道具 · 独立概率锻造冒险',
    images: [{ url: '/og.png', alt: '猫游记天穹工坊' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '猫游记 · 天穹工坊',
    description: '24 组官方公示道具 · 独立概率锻造冒险',
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
