import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Membership from '@/core/client/features/loyalty/Membership';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, isEnglish, jsonLd, pageMetadata } from '@/shared/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const en = isEnglish(locale);
  return pageMetadata(siteUrl(), {
    locale,
    path: '/services/loyalty',
    title: en ? 'Collector Club Membership – Points and Perks' : 'Hội Viên Collector Club – Tích Điểm & Ưu Đãi Mô Hình',
    description: en
      ? 'Join the Model Universe Collector Club: earn points on every order, tier discounts and early access to rare, limited model kits.'
      : 'Gia nhập Collector Club của Model Universe: tích điểm mỗi đơn mô hình, chiết khấu theo hạng thành viên và ưu tiên sở hữu mô hình hiếm, số lượng giới hạn.',
    keywords: en ? undefined : ['hội viên mô hình', 'tích điểm mô hình', 'ưu đãi gunpla', 'collector club'],
  });
}

export default async function MembershipPage({ params }: Props) {
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
              [en ? 'Membership' : 'Hội viên', '/services/loyalty'],
            ]),
          ]),
        }}
      />
      <Membership />
    </StoreLayout>
  );
}
