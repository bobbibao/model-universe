import StoreLayout from '@/components/Layouts/StoreLayout';
import Wishlist from '@/core/client/features/account/pages/Wishlist';
import { privatePageMetadata } from '@/shared/seo';

export const metadata = privatePageMetadata('Danh sách yêu thích');

const WishlistPage = () => {
  return (
    <StoreLayout>
      <Wishlist />
    </StoreLayout>
  );
};

export default WishlistPage;
