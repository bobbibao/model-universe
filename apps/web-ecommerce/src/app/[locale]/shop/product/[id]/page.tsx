import { notFound, permanentRedirect } from 'next/navigation';
import { getPublicProduct } from '@/shared/server/utils/StorefrontData';

type Props = { params: Promise<{ locale: string; id: string }> };

// Older links (/shop/product/<id>, also used by the shopping assistant and the cart) move permanently to the SEO path;
// a condition option's id keeps that option selected.
export default async function Page({ params }: Props) {
  const { locale, id } = await params,
    product = await getPublicProduct(/^\d+$/.test(id) ? Number(id) : id);
  if (!product?.slug) notFound();
  const option =
    product.selectedOptionId && product.selectedOptionId !== product.id
      ? `?tinh-trang=${product.selectedOptionId}`
      : '';
  permanentRedirect(`/${locale === 'en' ? 'en' : 'vi'}/san-pham/${product.slug}${option}`);
}
