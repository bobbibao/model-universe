import { Metadata } from 'next';
import ProductConditionList from '@/core/client/features/product-management/pages/ProductConditionList';

export const metadata: Metadata = {
  title: 'Tình trạng sản phẩm - Quản trị Model Universe',
};

const ProductConditionsPage = () => <ProductConditionList />;

export default ProductConditionsPage;
