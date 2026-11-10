import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Movie Discovery',
  description: 'Discover popular movies and find where to stream them in Canada',
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000'
  ),
  openGraph: {
    title: 'Movie Discovery',
    description: 'Discover popular movies and find where to stream them in Canada',
    type: 'website',
    locale: 'en_CA',
    siteName: 'Movie Discovery',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Movie Discovery',
    description: 'Discover popular movies and find where to stream them in Canada',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <SiteNav />
        {/* No header bar: pages start just below the floating menu button and use the whole screen. */}
        <main className="flex-1 pt-16">{children}</main>
        {modal /* movie popup (app/@modal), shown over the page */}
        <Footer />
      </body>
    </html>
  );
}