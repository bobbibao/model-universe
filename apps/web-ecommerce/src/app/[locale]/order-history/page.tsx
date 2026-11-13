import StoreLayout from '@/components/Layouts/StoreLayout';
import OrderHistory from '@/core/client/features/account/pages/OrderHistory';
import { privatePageMetadata } from '@/shared/seo';

export const metadata = privatePageMetadata('Lịch sử đơn hàng');

const OrderHistoryPage = () => {
  return (
    <StoreLayout>
      <OrderHistory />
    </StoreLayout>
  );
};

export default OrderHistoryPage;
