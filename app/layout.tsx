import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI-Manusia | Tanya AI, Manusia Jawab',
  description: 'Tanya apa sahaja. AI akan jawab... atau akan dia?',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms">
      <body className={`${inter.className} bg-[#1A1A2E] text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
