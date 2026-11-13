import { Suspense } from 'react';
import StoreLayout from '@/components/Layouts/StoreLayout';
import ThankYou from '@/core/client/features/cart/pages/ThankYou';
import { privatePageMetadata } from '@/shared/seo';

export const metadata = privatePageMetadata('Đặt hàng thành công');

const ThankYouPage = () => {
  return (
    <StoreLayout>
      <Suspense>
        <ThankYou />
      </Suspense>
    </StoreLayout>
  );
};

export default ThankYouPage;
