import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Link from '@/i18n/navigation';
import { GUIDES } from '@/shared/guides';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, jsonLd, pageMetadata } from '@/shared/seo';

type Props = { params: Promise<{ locale: string }> };

const TITLE = 'Hướng Dẫn Mô Hình Lắp Ráp: Chọn Kit, Lắp, Bảo Quản';
const DESCRIPTION =
  'Hướng dẫn cho người chơi mô hình lắp ráp: Gunpla là gì, phân biệt HG/RG/MG/PG, chọn kit đầu tiên, dụng cụ, mua hàng 2hand, kit Trung Quốc và cách bảo quản.';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(siteUrl(), { locale, path: '/huong-dan', title: TITLE, description: DESCRIPTION });
}

// The guide index: every guide with its direct answer, so the list itself answers the common questions.
export default async function GuidesPage({ params }: Props) {
  const { locale } = await params;
  const base = siteUrl();
  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            {
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: TITLE,
              description: DESCRIPTION,
              url: `${base}/${locale}/huong-dan`,
              hasPart: GUIDES.map((guide) => ({
                '@type': 'Article',
                headline: guide.title,
                url: `${base}/${locale}/huong-dan/${guide.slug}`,
              })),
            },
            breadcrumbSchema(base, locale, [['Hướng dẫn', '/huong-dan']]),
          ]),
        }}
      />
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-800">
        <h1 className="text-3xl font-bold leading-tight text-slate-900">Hướng dẫn mô hình lắp ráp</h1>
        <p className="mt-3 leading-relaxed">
          Câu trả lời ngắn gọn cho những điều người chơi hay hỏi trước khi mua, lắp, bảo quản hoặc bán lại mô hình.
        </p>
        <ul className="mt-8 space-y-5">
          {GUIDES.map((guide) => (
            <li key={guide.slug} className="rounded-xl border border-slate-200 p-5">
              <h2 className="text-xl font-semibold text-slate-900">
                <Link href={`/huong-dan/${guide.slug}`} className="hover:underline">
                  {guide.title}
                </Link>
              </h2>
              <p className="mt-2 leading-relaxed">{guide.answer}</p>
              <Link
                href={`/huong-dan/${guide.slug}`}
                className="mt-3 inline-block font-medium text-primary hover:underline"
              >
                Đọc hướng dẫn →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </StoreLayout>
  );
}
