'use client';
import ConditionStockTransfer from './ConditionStockTransfer';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import Modal from '@/components/Modal/Modal';
import TextField from '@/components/FormElements/TextField';
import SelectField from '@/components/FormElements/SelectField';
import ConditionTreePicker from '@/components/Store/ConditionTreePicker';
import ProductImage from '@/components/ProductImage';
import ProductApi from '@/core/client/api/Product';
import Api from '@/core/client/api/Api';
import type { AdminProduct } from '@/shared/types/product';
import type { ItemTypeKey } from '@/shared/condition-tree';
import { itemTypeLabel } from '@/shared/condition-tree';
import { catalogPricing } from '@/shared/sale-pricing';
import { formatVND } from '@/shared/server/utils/utils';
import ProductImagesField, { type ImageItem, imageFromUrl, uploadPendingImages } from './ProductImagesField';

export default function ProductConditions({
  product,
  onCreated,
  onEditCurrent,
}: {
  product: AdminProduct;
  onCreated: () => void;
  onEditCurrent: () => void;
}) {
  const locale = useLocale(),
    en = locale === 'en';
  const createRequested = useSearchParams().get('create') === '1';
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ItemTypeKey>('preowned');
  const [percent, setPercent] = useState('');
  const [ids, setIds] = useState<number[]>([]);
  const [price, setPrice] = useState('');
  const [mainImage, setMainImage] = useState<ImageItem | null>(null);
  const [gallery, setGallery] = useState<ImageItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [existingId, setExistingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open || !product.modelFamilyId) return;
    let current = true;
    setMatching(true);
    Api.post('/product-condition-tree/match', {
      modelFamilyId: product.modelFamilyId,
      itemTypeKey: type,
      conditionNodeIds: ids,
    })
      .then((response) => {
        if (current) setExistingId(response.data.productId);
      })
      .catch(() => {
        if (current) {
          setExistingId(null);
          setError(en ? 'Could not check this combination. Retry.' : 'Không kiểm tra được tổ hợp. Vui lòng thử lại.');
        }
      })
      .finally(() => {
        if (current) setMatching(false);
      });
    return () => {
      current = false;
    };
  }, [open, product.modelFamilyId, type, ids, en]);
  let pricing: ReturnType<typeof catalogPricing> | undefined;
  try {
    if (price) pricing = catalogPricing(Number(price));
  } catch {
    /* validation appears on submit */
  }
  const start = () => {
    setType(product.itemTypeKey ?? 'preowned');
    setPercent(product.conditionPercent != null ? String(product.conditionPercent) : '');
    setIds(product.conditionNodeIds ?? []);
    setPrice('');
    setMainImage(imageFromUrl(product.imageUrl));
    setGallery((product.images ?? []).map(imageFromUrl));
    setError('');
    setExistingId(null);
    setOpen(true);
  };
  useEffect(() => {
    if (createRequested) start();
  }, [createRequested, product.id]);
  const create = async () => {
    if (!pricing || !mainImage) {
      setError(
        en ? 'Enter a positive whole VND price and choose an image.' : 'Nhập giá S nguyên dương và chọn ảnh đại diện.',
      );
      return;
    }
    setBusy(true);
    setError('');
    const uploaded = await uploadPendingImages([mainImage, ...gallery]);
    if (uploaded) {
      setMainImage(imageFromUrl(uploaded[0]));
      setGallery(uploaded.slice(1).map(imageFromUrl));
      const result = await ProductApi.createConditionOption(product.id, {
        condition: type,
        conditionPercent: percent ? Number(percent) : null,
        itemTypeKey: type,
        conditionNodeIds: ids,
        pricingReferenceMemberVnd: Number(price),
        stock: 0,
        importPrice: 0,
        productionDate: null,
        imageUrl: uploaded[0],
        images: uploaded.slice(1),
      });
      if (result) {
        setOpen(false);
        onCreated();
      }
    }
    setBusy(false);
  };
  return (
    <section className="catalog-variants">
      <div className="catalog-section-toolbar">
        <div>
          <h3>{en ? 'Products of this model' : 'Các sản phẩm của mẫu này'}</h3>
          <p>
            {en
              ? 'Each condition combination has its own price and stock.'
              : 'Mỗi tổ hợp tình trạng có giá và tồn kho riêng.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ConditionStockTransfer product={product} onFinished={onCreated} />
          <button type="button" className="mu-button" onClick={start}>
            {en ? '+ Add combination' : '+ Thêm tổ hợp'}
          </button>
        </div>
      </div>
      <div className="catalog-variant-table-wrap">
        <table className="catalog-variant-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>{en ? 'Type / conditions' : 'Loại hàng / tình trạng'}</th>
              <th>{en ? 'Real price S' : 'Giá bán thực S'}</th>
              <th>{en ? 'Stock' : 'Tồn kho'}</th>
              <th>{en ? 'Visibility' : 'Hiển thị'}</th>
              <th>
                <span className="sr-only">{en ? 'Edit' : 'Chỉnh sửa'}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(product.units ?? []).map((unit) => (
              <tr key={unit.id} className={unit.id === product.id ? 'is-current' : ''}>
                <td>{unit.sku}</td>
                <td>
                  <span className={`condition-chip is-${unit.itemTypeKey ?? unit.condition}`}>
                    {itemTypeLabel(unit.itemTypeKey ?? unit.condition)}
                    {unit.conditionPercent ? ` · ${unit.conditionPercent}%` : ''}
                  </span>
                  <span className="catalog-combination-label">
                    {unit.conditionLabels?.join(' · ') || (en ? 'No issues recorded' : 'Không ghi nhận lỗi')}
                  </span>
                </td>
                <td className="catalog-money">{formatVND(unit.pricingReferenceMemberVnd ?? 0, locale)}</td>
                <td>{unit.stock}</td>
                <td>
                  <span className={`catalog-status ${unit.isArchived ? 'is-draft' : ''}`}>
                    {unit.isArchived ? (en ? 'Draft / hidden' : 'Nháp / ẩn') : en ? 'Published' : 'Đang bán'}
                  </span>
                </td>
                <td>
                  {unit.id === product.id ? (
                    <button type="button" onClick={onEditCurrent}>
                      {en ? 'Edit' : 'Sửa'}
                    </button>
                  ) : (
                    <Link href={`/admin/products/${unit.id}`}>{en ? 'Edit' : 'Sửa'}</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!product.stockReceipts?.length && (
        <details className="catalog-image-disclosure mt-5">
          <summary>
            {en ? 'Stock receipt / condition transfer history' : 'Lịch sử nhập hàng / chuyển tình trạng'}
          </summary>
          <div className="catalog-variant-table-wrap mt-3">
            <table className="catalog-variant-table">
              <thead>
                <tr>
                  <th>{en ? 'Source' : 'Nguồn hàng'}</th>
                  <th>{en ? 'Quantity' : 'Số lượng'}</th>
                  <th>{en ? 'Unit cost' : 'Giá vốn / món'}</th>
                  <th>{en ? 'Recorded at' : 'Ngày ghi nhận'}</th>
                </tr>
              </thead>
              <tbody>
                {product.stockReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>
                      {receipt.sourceType === 'buyback' || receipt.sourceType === 'pawn' ? (
                        <Link href={`/admin/${receipt.sourceType}`}>
                          {receipt.sourceType} #{receipt.sourceId} ↗
                        </Link>
                      ) : (
                        `${receipt.sourceType} #${receipt.sourceId}`
                      )}
                    </td>
                    <td>
                      {receipt.quantity > 0 ? '+' : ''}
                      {receipt.quantity}
                    </td>
                    <td className="catalog-money">{formatVND(receipt.unitCostVnd, locale)}</td>
                    <td>{new Date(receipt.createdAt).toLocaleDateString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <Modal
        open={open}
        title={en ? 'Create a new condition combination' : 'Tạo sản phẩm với tổ hợp mới'}
        size="lg"
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        footer={
          <>
            <button
              type="button"
              className="mu-button mu-button-secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {en ? 'Cancel' : 'Hủy'}
            </button>
            <button
              type="button"
              className="mu-button"
              disabled={busy || matching || !!existingId || !product.modelFamilyId}
              onClick={create}
            >
              {busy ? '…' : en ? 'Save draft · stock 0' : 'Lưu nháp · tồn 0'}
            </button>
          </>
        }
      >
        <div className="catalog-inherited-model">
          <span className="catalog-model-thumb">
            <ProductImage src={product.imageUrl} alt="" sizes="56px" className="object-contain" />
          </span>
          <div>
            <strong>{product.name}</strong>
            <p>
              {product.brandName} · {product.scale} · {product.modelCode}
            </p>
          </div>
        </div>
        {!product.modelFamilyId && (
          <p role="alert" className="catalog-inline-notice">
            {en
              ? 'Reconcile this legacy product and save its type/conditions first.'
              : 'Đối chiếu và lưu loại hàng/tình trạng của sản phẩm cũ trước khi tạo tổ hợp.'}
          </p>
        )}
        <fieldset disabled={busy} className="catalog-variant-form">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={en ? 'Item type' : 'Loại hàng'}
              name="variantType"
              options={[
                { value: 'new', label: 'New' },
                { value: 'preowned', label: '2hand' },
              ]}
              value={type}
              onChange={(event) => {
                setType(event.target.value as ItemTypeKey);
                setIds([]);
              }}
            />
            <TextField
              label={en ? 'Real selling price S (VND)' : 'Giá bán thực S (đ)'}
              name="variantSalePrice"
              type="number"
              min={1}
              step={1}
              value={price}
              required
              onChange={(event) => setPrice(event.target.value)}
            />
            {type === 'preowned' && (
              <div className="sm:col-span-2">
                <TextField
                  label={en ? 'Condition percentage (%)' : 'Mức độ phần trăm 2hand (%)'}
                  name="variantConditionPercent"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  placeholder="95"
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                />
              </div>
            )}
          </div>
          <ConditionTreePicker value={ids} itemType={type} onChange={setIds} />
          {matching && <p role="status">{en ? 'Checking combination…' : 'Đang kiểm tra tổ hợp…'}</p>}
          {existingId && (
            <div className="catalog-inline-notice">
              <strong>{en ? 'This combination already exists.' : 'Tổ hợp này đã có sản phẩm.'}</strong>
              <Link href={`/admin/products/${existingId}`}>
                {en ? 'Open product' : 'Mở sản phẩm'} #{existingId}
              </Link>
              <Link href="/admin/stock">{en ? 'Receive more stock' : 'Nhập thêm hàng'} ↗</Link>
            </div>
          )}
          {pricing && (
            <dl className="catalog-derived-prices">
              <div>
                <dt>{en ? 'Web price' : 'Giá web'}</dt>
                <dd>{formatVND(pricing.listPriceVnd, locale)}</dd>
              </div>
              <div>
                <dt>{en ? 'Buyback estimate' : 'Giá thu dự kiến'}</dt>
                <dd>{formatVND(pricing.buybackPriceVnd, locale)}</dd>
              </div>
              <div>
                <dt>C50</dt>
                <dd>{formatVND(pricing.pawnPriceVnd, locale)}</dd>
              </div>
            </dl>
          )}
          <details className="catalog-image-disclosure">
            <summary>{en ? 'Inherited images · change if needed' : 'Ảnh kế thừa · thay đổi nếu cần'}</summary>
            <p>
              {en
                ? 'A 2hand product needs an actual uploaded photo before publication.'
                : 'Sản phẩm 2hand cần ảnh thật đã tải lên trước khi xuất bản.'}
            </p>
            <ProductImagesField
              mainImage={mainImage}
              gallery={gallery}
              onMainImageChange={setMainImage}
              onGalleryChange={setGallery}
            />
          </details>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </fieldset>
      </Modal>
    </section>
  );
}
