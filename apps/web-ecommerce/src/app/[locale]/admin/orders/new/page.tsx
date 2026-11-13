import DirectSale from '@/core/client/features/order-management/pages/DirectSale';
import { privatePageMetadata } from '@/shared/seo';

export const metadata = privatePageMetadata('Bán trực tiếp');
export default function DirectSalePage() {
  return <DirectSale />;
}
