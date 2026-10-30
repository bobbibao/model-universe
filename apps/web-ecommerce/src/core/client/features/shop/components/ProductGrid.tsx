import type { ProductSummary } from '@/shared/types/product';
import ProductCard from './ProductCard';
import { useTranslations } from 'next-intl';
import AdminIcon from '@/components/Admin/AdminIcon';

interface ProductGridProps {
  products: ProductSummary[];
  loading?: boolean;
  emptyText?: string;
  onReset?: () => void;
  skeletonCount?: number;
}

const ProductGrid = ({
  products,
  loading = false,
  emptyText = 'No models found.',
  onReset,
  skeletonCount = 12,
}: ProductGridProps) => {
  const ux = useTranslations('commerceUX');
  if (loading) {
    return (
      <div
        className="catalog-product-grid grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
        aria-hidden="true"
      >
        {Array.from({ length: skeletonCount }, (_, index) => (
          <div key={index} className="catalog-product-skeleton">
            <div className="catalog-skeleton-photo" />
            <div className="catalog-skeleton-copy">
              <span />
              <span />
              <span />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (products.length === 0) {
    return (
      <div className="catalog-empty">
        <AdminIcon name="search" size={32} />
        <h2>{emptyText}</h2>
        <p>{ux('emptyHint')}</p>
        {onReset && (
          <button type="button" className="mu-button" onClick={onReset}>
            {ux('clearFilters')}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="catalog-product-grid grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};

export default ProductGrid;
