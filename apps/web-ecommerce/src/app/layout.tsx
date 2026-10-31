import '@/css/satoshi.css';
import '@/css/style.css';
import 'react-toastify/dist/ReactToastify.css';
import '@/css/toast-custom.css';
import '@/css/customer-assistant.css';
import '@/css/model-universe.css';
import '@/css/admin-workspace.css';
import '@/css/finance-workspace.css';
import '@/css/collector-studio.css';
import '@/css/catalog-controls.css';
import '@/css/workspace-controls.css';
import '@/css/commerce-workspace.css';
import '@/css/store-workspaces.css';
import '@/css/checkout-payment.css';
import '@/css/promotions.css';
import '@/css/product-conditions.css';
import '@/css/commerce-experience.css';
import '@/css/compact-workspaces.css';
import '@/css/product-forms.css';
import '@/css/direct-sales.css';
import '@/css/condition-tree.css';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import AppProviders from '@/components/AppProviders';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  return {
    metadataBase: new URL(base),
    title: {
      default: 'Model Universe — Hệ Thống Mô Hình 2hand, Gunpla & Figure Chính Hãng',
      template: '%s | Model Universe',
    },
    description:
      'Chuyên mô hình Gundam, Metal Build, Figure hợp kim chính hãng 2hand (độ mới 95-98%). Định giá 3 giá minh bạch, kiểm định nghiêm ngặt, giao hàng COD toàn quốc tại Model Universe.',
    keywords: [
      'mô hình 2hand',
      'mô hình gundam cũ',
      'metal build 2hand',
      'figure chính hãng',
      'cangdao',
      'motor nuclear',
      'snaa',
      'in era',
      'moshow',
      'thu mua mô hình',
      'ký gửi mô hình',
      'model universe',
    ],
    authors: [{ name: 'Model Universe', url: base }],
    creator: 'Model Universe',
    publisher: 'Model Universe',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: 'Model Universe — Hệ Thống Mô Hình 2hand, Gunpla & Figure Chính Hãng',
      description:
        'Chuyên mô hình Gundam, Metal Build, Figure chính hãng 2hand độ mới 95-98%. Giá minh bạch, hỗ trợ thu đổi, giao hàng toàn quốc.',
      url: base,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Model Universe — Mô hình 2hand & Figure Chính Hãng',
        },
      ],
      locale: 'vi_VN',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Model Universe — Hệ Thống Mô Hình 2hand, Gunpla & Figure Chính Hãng',
      description:
        'Chuyên mô hình Gundam, Metal Build, Figure chính hãng 2hand độ mới 95-98%. Giá minh bạch, giao hàng toàn quốc.',
      images: [`${base}/images/store/hero.jpg`],
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
