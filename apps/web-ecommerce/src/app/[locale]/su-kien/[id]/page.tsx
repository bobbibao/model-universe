import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import SaleEventPage from '@/core/client/features/sales/SaleEventPage';

export const metadata: Metadata = {
  title: 'Sự kiện sale mô hình | Model Universe',
  description: 'Mô hình đang giảm giá trong sự kiện sale của Model Universe, tồn kho thực.',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <StoreLayout>
      <SaleEventPage id={Number((await params).id)} />
    </StoreLayout>
  );
}
