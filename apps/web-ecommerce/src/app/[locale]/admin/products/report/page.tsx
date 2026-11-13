import InventoryStats from '@/core/client/features/product-management/components/InventoryStats';
import Link from '@/i18n/navigation';
import { privatePageMetadata } from '@/shared/seo';

export const metadata = privatePageMetadata('Phân tích tồn kho');

export default function InventoryReport() {
  return (
    <div className="catalog-inventory-report">
      <div className="catalog-report-heading">
        <h1>Phân tích tồn kho</h1>
        <Link href="/admin/products">← Danh sách sản phẩm</Link>
      </div>
      <InventoryStats expanded />
    </div>
  );
}
