import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CUSTOMER_ASSISTANT_ENABLED } from '@/shared/customer-assistant-policy';
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

// While the storefront assistant is off, its page sends visitors to the store (a temporary redirect).
export default async function AssistantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  if (!CUSTOMER_ASSISTANT_ENABLED) redirect(`/${(await params).locale}/cua-hang`);
  return children;
}
