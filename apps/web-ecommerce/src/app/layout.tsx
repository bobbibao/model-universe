import '@/css/satoshi.css';
import '@/css/style.css';
import 'react-toastify/dist/ReactToastify.css';
import '@/css/toast-custom.css';
import '@/css/customer-assistant.css';
import '@/css/model-universe.css';
import '@/css/collector-studio.css';
import '@/css/catalog-controls.css';
import '@/css/workspace-controls.css';
import '@/css/commerce-workspace.css';
import '@/css/store-workspaces.css';
import '@/css/checkout-payment.css';
import '@/css/promotions.css';
import '@/css/product-conditions.css';
import '@/css/commerce-experience.css';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import AppProviders from '@/components/AppProviders';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { OG_IMAGE, SITE_NAME } from '@/shared/seo';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0d14',
};

export function generateMetadata(): Metadata {
  const base = siteUrl();
  const title = 'Model Universe – Mô Hình Lắp Ráp, Gunpla, Mecha New & 2hand';
  const description =
    'Vũ Trụ Mô Hình – Model Universe: mua bán mô hình lắp ráp Gunpla, Mecha, Robot, kit Trung Quốc New & 2hand. Thu mua, trade, cầm cố, hỗ trợ lắp ráp. Gò Vấp, TP.HCM, COD toàn quốc.';
  return {
    metadataBase: new URL(base),
    applicationName: SITE_NAME,
    title: {
      default: title,
      template: `%s | ${SITE_NAME}`,
    },
    description,
    authors: [{ name: SITE_NAME, url: base }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      url: base,
      images: [{ url: `${base}${OG_IMAGE.path}`, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: title }],
      locale: 'vi_VN',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${base}${OG_IMAGE.path}`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    },
    // Google shows the site icon next to the result only when it is a square of at least 48px.
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '32x32' },
        { url: '/icons/icon-48.png', sizes: '48x48', type: 'image/png' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      shortcut: '/favicon.ico',
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  };
}
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    // Browser extensions (password managers, translators, assistants) add attributes to <html> and <body> before React
    // hydrates; suppressHydrationWarning ignores attribute differences on these two elements only, not their children.
    // data-scroll-behavior keeps the smooth scrolling from style.css while Next.js routes (Next 15 contract).
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <body id="workspace-page" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Ho_Chi_Minh">
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
