'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import { toast } from 'react-toastify';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import { useRestockAlerts } from '@/shared/client/providers/RestockAlertsProvider';

export default function RestockAlert({
  productId,
  returnTo,
  className = 'mu-button',
}: {
  productId: number;
  returnTo?: string;
  className?: string;
}) {
  const t = useTranslations('customerTools');
  const locale = useLocale();
  const { user } = useCurrentUser();
  const { rows, loading, save } = useRestockAlerts();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = rows.some((row) => row.productId === productId && row.active);

  const bellIcon = (
    <span className="restock-alert-icon" aria-hidden="true">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    </span>
  );

  return (
    <div className="restock-action">
      {!user ? (
        <Link
          className={className}
          href={'/auth/signin?redirect=' + encodeURIComponent(returnTo || '/shop/product/' + productId)}
          title={t('startAlert')}
        >
          {bellIcon}
          <span className="restock-alert-label">{t('startAlert')}</span>
        </Link>
      ) : (
        <button
          type="button"
          className={className}
          disabled={busy || loading}
          aria-pressed={active}
          onClick={async () => {
            setBusy(true);
            setFailed(false);
            const nextActive = !active;
            try {
              await save(productId, nextActive);
              if (nextActive) {
                toast.success(
                  locale === 'en'
                    ? '🔔 Restock notification enabled! You will be notified when available.'
                    : '🔔 Đã bật thông báo! Bạn sẽ nhận tin ngay khi mô hình có hàng trở lại.',
                  { toastId: `restock-${productId}` },
                );
              } else {
                toast.info(
                  locale === 'en'
                    ? 'Restock notification turned off.'
                    : 'Đã tắt nhận thông báo có hàng cho sản phẩm này.',
                  { toastId: `restock-${productId}` },
                );
              }
            } catch {
              setFailed(true);
              toast.error(
                locale === 'en'
                  ? 'Could not update restock alert. Please try again.'
                  : 'Không thể cập nhật thông báo. Vui lòng thử lại.',
                { toastId: `restock-err-${productId}` },
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {bellIcon}
          <span className="restock-alert-label">{active ? t('stopAlert') : t('startAlert')}</span>
        </button>
      )}
      {active && (
        <p role="status" className="mu-note">
          {t('alertActive')}
        </p>
      )}
      {failed && (
        <p role="alert" className="mu-note">
          {t('alertFailed')}
        </p>
      )}
    </div>
  );
}
