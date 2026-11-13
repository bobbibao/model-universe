import StoreLayout from '@/components/Layouts/StoreLayout';
import Cart from '@/core/client/features/cart/pages/Cart';
import { privatePageMetadata } from '@/shared/seo';

export const metadata = privatePageMetadata('Giỏ hàng');

const CartPage = () => {
  return (
    <StoreLayout>
      <Cart />
    </StoreLayout>
  );
};

export default CartPage;
