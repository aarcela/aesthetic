import type { Metadata, Viewport } from 'next';
import { Figtree, Noto_Sans } from 'next/font/google';

import { AuthProvider } from '@/lib/auth';

import './globals.css';

const heading = Figtree({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading-loaded',
  display: 'swap',
});

const body = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aesthetic — Clínica, agenda y caja',
  description:
    'Agenda, pacientes y caja en dólares y bolívares para clínicas estéticas en Venezuela.',
};

export const viewport: Viewport = {
  themeColor: '#f2f5f4',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${heading.variable} ${body.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
