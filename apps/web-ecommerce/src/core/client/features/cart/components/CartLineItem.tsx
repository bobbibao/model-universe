'use client';

import Link from '@/i18n/navigation';
import { useProductConditions } from '@/shared/client/hooks/useProductConditions';
import { useLocale, useTranslations } from 'next-intl';
import ProductImage from '@/components/ProductImage';
import AdminIcon from '@/components/Admin/AdminIcon';
import { CartEntry, useCart } from '@/shared/client/providers/CartProvider';
import { formatVND } from '@/shared/server/utils/utils';
import { memberPrice } from '@/shared/pricing';

const CartLineItem = ({ entry }: { entry: CartEntry }) => {
  const t = useTranslations('checkout'),
    catalog = useTranslations('catalog'),
    locale = useLocale();
  const conditionTypes = useProductConditions();
  const { updateQuantity, removeItem } = useCart();
  const { item, line } = entry;
  const product = line?.product;
  const name = product?.name || item.name;
  // The server quote's effective price (after any running discount); the stored snapshot until it arrives.
  const price = product?.salePrice ?? item.price;
  // A shop item outside a sale shows its member price S (R with the member code) first, R struck (owner rule of
  // 2026-10-26); the code itself is applied in the summary.
  const member = !!product && !product.partnerId && !(product.discountPercent > 0 && product.salePrice < product.price);
  const status = line?.status;
  const unavailable = status === 'UNAVAILABLE' || status === 'OUT_OF_STOCK';
  const maxQuantity = line && line.availableStock > 0 ? line.availableStock : item.quantity;

  return (
    <article className={`cart-line-item ${unavailable ? 'is-unavailable' : ''}`}>
      <Link href={`/shop/product/${item.productId}`} className="cart-line-photo">
        <ProductImage src={product?.imageUrl || item.imageUrl} alt={name} sizes="88px" className="object-contain" />
      </Link>
      <div className="cart-line-copy">
        <Link href={`/shop/product/${item.productId}`} className="cart-line-name">
          {name}
        </Link>
        <p className="cart-line-meta">
          {t('brand')}: {product?.brandName || item.brandName}
          {product?.condition && product.condition !== 'new' && (
            <>
              {' '}
              <span className={`condition-chip is-${product.condition}`}>
                {conditionTypes.label(product.condition)}
              </span>
            </>
          )}
        </p>
        {!!product?.partnerId && <p className="text-sm text-brand">{t('partnerItem')}</p>}
        {line && status !== 'OK' && <p className="text-sm font-medium text-danger">{t(`lineStatus.${status}`)}</p>}
        <div className="cart-line-controls">
          <div className="cart-quantity">
            <button
              className="cart-quantity-button"
              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
              disabled={item.quantity <= 1 || unavailable}
              aria-label={t('decrease')}
            >
              −
            </button>
            <output aria-label={t('quantity')}>{item.quantity}</output>
            <button
              className="cart-quantity-button"
              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
              disabled={item.quantity >= maxQuantity || unavailable}
              aria-label={t('increase')}
            >
              +
            </button>
          </div>
          {status === 'INSUFFICIENT_STOCK' && line && line.availableStock > 0 && (
            <button
              className="text-sm font-medium text-brand-hover hover:underline"
              onClick={() => updateQuantity(item.productId, Math.min(item.quantity, line.availableStock))}
            >
              {t('reduce', { count: Math.min(item.quantity, line.availableStock) })}
            </button>
          )}
          <button className="cart-line-remove" onClick={() => removeItem(item.productId)}>
            <AdminIcon name="close" size={14} />
            {t('remove')}
          </button>
        </div>
      </div>
      <div className={`cart-line-total${member ? ' is-member' : ''}`}>
        {member ? (
          <>
            <span className="cart-line-member-badge">{t('memberPrice')}</span>
            <p className={unavailable ? 'line-through' : ''}>{formatVND(memberPrice(price) * item.quantity, locale)}</p>
            <s aria-label={t('listPrice')}>{formatVND(price * item.quantity, locale)}</s>
            <span>{t('unitPrice', { price: formatVND(memberPrice(price), locale) })}</span>
          </>
        ) : (
          <>
            <p className={unavailable ? 'line-through' : ''}>{formatVND(price * item.quantity, locale)}</p>
            <span>{t('unitPrice', { price: formatVND(price, locale) })}</span>
          </>
        )}
      </div>
    </article>
  );
};

export default CartLineItem;
