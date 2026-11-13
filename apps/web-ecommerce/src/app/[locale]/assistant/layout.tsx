import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { isEnglish, pageMetadata } from '@/shared/seo';

// The assistant page is a client component, so its search metadata (own title, description, canonical and hreflang
// instead of the home page's) lives here.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(
    siteUrl(),
    isEnglish(locale)
      ? {
          locale,
          path: '/assistant',
          title: 'AI Kit Assistant: Find and Compare Model Kits',
          description:
            'Ask the Model Universe AI assistant to find Gunpla and mecha kits for your budget, compare models, read reviews and prepare your bag. It only recommends kits this shop sells.',
        }
      : {
          locale,
          path: '/assistant',
          title: 'Trợ Lý AI Tư Vấn Mô Hình: Tìm Kit, So Sánh Mẫu',
          description:
            'Hỏi trợ lý AI của Model Universe để tìm mô hình Gunpla, Mecha theo ngân sách, so sánh mẫu, xem đánh giá và chuẩn bị giỏ hàng. Chỉ tư vấn mô hình shop đang bán.',
        },
  );
}

export default function AssistantLayout({ children }: { children: ReactNode }) {
  return children;
}
