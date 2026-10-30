'use client';

import ProductOwnership from '../components/ProductOwnership';
import { useTranslations } from 'next-intl';
import { useProductConditions } from '@/shared/client/hooks/useProductConditions';
import { useCallback, useEffect, useState } from 'react';
import Link from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { useParams, useSearchParams } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb';
import WorkspaceTabs from '@/components/Store/WorkspaceTabs';
import ConfirmModal from '@/components/Modal/ConfirmModal';
import ProductApi from '@/core/client/api/Product';
import type { AdminProduct } from '@/shared/types/product';
import ProductImagesField, { ImageItem, imageFromUrl, uploadPendingImages } from '../components/ProductImagesField';
import ProductConditions from '../components/ProductConditions';
import {
  BasicInfoFields,
  DescriptionFields,
  ConditionFields,
  InventoryFields,
  PricingFields,
  StatusFields,
} from '../components/ProductFormSections';
import {
  ProductFormErrors,
  ProductFormValues,
  buildProductPayload,
  emptyProductForm,
  toFormValues,
  validateProductForm,
  validateProductImages,
} from '../components/productForm';

const tabForError = (key: string) => {
  if (key === 'mainImage') return 'images';
  if (['price', 'importPrice', 'pricingReferenceMemberVnd', 'pricingReferencePreownedVnd'].includes(key))
    return 'pricing';
  if (['missingAccessories', 'defects', 'includedAccessories', 'condition', 'conditionNote'].includes(key))
    return 'conditions';
  if (['stock', 'sku', 'weight', 'dimensions', 'productionDate'].includes(key) || key.startsWith('pack'))
    return 'inventory';
  return 'basics';
};

const ProductEdit = () => {
  const router = useRouter();
  const t = useTranslations('adminProducts');
  const ux = useTranslations('commerceUX');
  const conditions = useProductConditions();
  const [activeTab, setActiveTab] = useState('basics');
  const params = useParams<{ id: string }>();
  const productId = Number(params.id);
  const section = useSearchParams().get('section');
  const [product, setProduct] = useState<AdminProduct | null>();
  const [values, setValues] = useState<ProductFormValues>(emptyProductForm);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [mainImage, setMainImage] = useState<ImageItem | null>(null);
  const [gallery, setGallery] = useState<ImageItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Resets the form to the stored product (initial load, discard changes and after saving).
  const applyProduct = useCallback((loaded: AdminProduct) => {
    setProduct(loaded);
    setValues(toFormValues(loaded));
    setMainImage(imageFromUrl(loaded.imageUrl));
    setGallery(loaded.images.map(imageFromUrl));
    setErrors({});
  }, []);

  const load = useCallback(
    () => ProductApi.getAdminProduct(productId).then((loaded) => (loaded ? applyProduct(loaded) : setProduct(null))),
    [productId, applyProduct],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (section === 'conditions') setActiveTab('conditions');
  }, [productId, section]);

  // Historical SKU identity is locked; quantities change through recorded stock operations.
  const uniqueUnit = product?.identityLocked === true;
  const onChange = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const formErrors: ProductFormErrors = validateProductForm(values, conditions.all);
    if (uniqueUnit && Number(values.stock) > (product?.stock ?? 0)) formErrors.stock = 'stockChangeRestricted';
    Object.assign(formErrors, validateProductImages(values, mainImage, conditions.all));
    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0 || !mainImage) {
      setActiveTab(tabForError(Object.keys(formErrors)[0]));
      requestAnimationFrame(() => {
        const panel = document.querySelector<HTMLElement>('.compact-admin-editor [role="tabpanel"]:not([hidden])');
        (panel?.querySelector<HTMLElement>('[aria-invalid="true"]:not([disabled])') || panel)?.focus();
      });
      return;
    }

    setSaving(true);
    const urls = await uploadPendingImages([mainImage, ...gallery]);
    if (urls) {
      // Keep the uploaded URLs so that a retry after a validation error does not upload the files again.
      setMainImage(imageFromUrl(urls[0]));
      setGallery(urls.slice(1).map(imageFromUrl));
    }
    const updated = urls
      ? await ProductApi.updateProduct(productId, {
          ...buildProductPayload(values, urls[0], urls.slice(1)),
          expectedStock: product?.stock,
          expectedPrice: product?.price,
        })
      : undefined;
    setSaving(false);
    if (updated) applyProduct(updated);
  };

  const remove = async () => {
    if (await ProductApi.deleteProduct(productId)) router.push('/admin/products');
    setConfirmingDelete(false);
  };

  if (product === undefined) {
    return (
      <div className="flex justify-center py-20">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4">{t('notFound')}</p>
        <Link href="/admin/products" className="font-medium text-brand-hover hover:underline">
          {t('backToList')}
        </Link>
      </div>
    );
  }

  if (product.catalogCanonicalId)
    return (
      <div className="catalog-inline-notice">
        <p>
          {t('name')}: {product.name} · SKU {product.sku}
        </p>
        <Link href={`/admin/products/${product.catalogCanonicalId}`}>
          Đã gộp vào sản phẩm #{product.catalogCanonicalId} →
        </Link>
      </div>
    );

  // A condition option: its model (name, brand, code, descriptions, box) is edited on the main listing.
  const option = false;

  return (
    <div className="compact-admin-product-page">
      <Breadcrumb pageName={t('edit')} />
      {option && product.listing && (
        <p className="compact-condition-parent">
          <span>{t('conditionOf', { name: product.listing.name })}</span>
          <Link
            href={`/admin/products/${product.listing.id}`}
            className="font-semibold text-brand-hover hover:underline"
          >
            {t('openListing')} →
          </Link>
        </p>
      )}
      <div className="compact-admin-editor">
        <div className="compact-admin-editor-main">
          {Object.keys(errors).length > 0 && (
            <p className="admin-load-error" role="alert">
              {ux('formErrors', { count: Object.keys(errors).length })}
            </p>
          )}
          <fieldset disabled={saving} className="product-editor-fields">
            <WorkspaceTabs
              label={ux('editorSections')}
              value={activeTab}
              onChange={setActiveTab}
              tabs={[
                {
                  id: 'basics',
                  label: t('basics'),
                  count: Object.keys(errors).filter((key) => tabForError(key) === 'basics').length || undefined,
                  content: (
                    <BasicInfoFields
                      values={values}
                      errors={errors}
                      onChange={onChange}
                      readOnly={option}
                      withCondition={false}
                      withDescriptions={false}
                    />
                  ),
                },
                {
                  id: 'conditions',
                  label: t('conditionSection'),
                  count: Object.keys(errors).filter((key) => tabForError(key) === 'conditions').length || undefined,
                  content: (
                    <div className="compact-condition-editor">
                      <ProductConditions
                        product={product}
                        onCreated={load}
                        onEditCurrent={() => {
                          const field = document.querySelector<HTMLElement>('#condition-fields select:not(:disabled)');
                          field?.focus();
                          field?.scrollIntoView({ block: 'center', behavior: 'instant' });
                        }}
                      />
                      <section className="condition-fields" id="condition-fields">
                        <h3>{t('editingCondition', { sku: product.sku })}</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <ConditionFields
                            values={values}
                            errors={errors}
                            onChange={onChange}
                            lockedCondition={uniqueUnit}
                          />
                        </div>
                      </section>
                    </div>
                  ),
                },
                {
                  id: 'images',
                  label: t('images'),
                  count: Object.keys(errors).filter((key) => tabForError(key) === 'images').length || undefined,
                  content: (
                    <ProductImagesField
                      mainImage={mainImage}
                      gallery={gallery}
                      onMainImageChange={setMainImage}
                      onGalleryChange={setGallery}
                      error={errors.mainImage ? t(`validation.${errors.mainImage}`) : undefined}
                    />
                  ),
                },
                {
                  id: 'pricing',
                  label: t('pricing'),
                  count: Object.keys(errors).filter((key) => tabForError(key) === 'pricing').length || undefined,
                  content: <PricingFields values={values} errors={errors} onChange={onChange} />,
                },
                {
                  id: 'inventory',
                  label: t('inventory'),
                  count: Object.keys(errors).filter((key) => tabForError(key) === 'inventory').length || undefined,
                  content: (
                    <InventoryFields
                      values={values}
                      errors={errors}
                      onChange={onChange}
                      readOnly={option}
                      maxStock={uniqueUnit ? product.stock : undefined}
                    />
                  ),
                },
                {
                  id: 'description',
                  label: ux('descriptionTab'),
                  content: <DescriptionFields values={values} errors={errors} onChange={onChange} readOnly={option} />,
                },
                {
                  id: 'supplierStatus',
                  label: 'Hiển thị',
                  content: (
                    <div className="grid gap-6">
                      <StatusFields values={values} onChange={onChange} />
                    </div>
                  ),
                },
              ]}
            />
          </fieldset>
          <div className="admin-editor-actions flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={saving}
              className="rounded-md border border-danger px-5 py-2 font-medium text-danger hover:bg-danger hover:text-white"
            >
              {t('remove')}
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => applyProduct(product)}
                disabled={saving}
                className="rounded-md border border-stroke px-5 py-2 font-medium dark:border-strokedark"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-md bg-brand px-5 py-2 font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-60"
              >
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ProductOwnership productId={productId} />
      <ConfirmModal
        open={confirmingDelete}
        title={t('remove')}
        message={t('deleteConfirm', { name: product.name })}
        confirmLabel={t('deleteLabel')}
        danger
        onConfirm={remove}
        onClose={() => setConfirmingDelete(false)}
      />
    </div>
  );
};

export default ProductEdit;
