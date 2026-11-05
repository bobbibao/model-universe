import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import PartnerWorkspace from '@/core/client/features/partner/PartnerWorkspace';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, isEnglish, jsonLd, pageMetadata } from '@/shared/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const en = isEnglish(locale);
  return pageMetadata(siteUrl(), {
    locale,
    path: '/services/partner',
    title: en ? 'Partner Program for Model Kit Sellers' : 'Hợp Tác Đối Tác & Ký Gửi Mô Hình',
    description: en
      ? 'Partner program for shops, distributors and collectors who want to list or consign model kits on Model Universe.'
      : 'Chương trình hợp tác cho cửa hàng, nhà phân phối và collector muốn ký gửi, mở rộng kênh bán mô hình lắp ráp trên Model Universe.',
    keywords: en ? undefined : ['ký gửi mô hình', 'hợp tác bán mô hình', 'đối tác mô hình'],
  });
}

export default async function PartnerPage({ params }: Props) {
  const { locale } = await params;
  const en = isEnglish(locale);
  const base = siteUrl();

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            breadcrumbSchema(base, locale, [
              [en ? 'Services' : 'Dịch vụ', '/services'],
              [en ? 'Partners' : 'Đối tác', '/services/partner'],
            ]),
          ]),
        }}
      />
      <PartnerWorkspace />
    </StoreLayout>
  );
}
