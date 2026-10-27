'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
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
  const t = useTranslations('customerTools'),
    { user } = useCurrentUser(),
    { rows, loading, save } = useRestockAlerts();
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const active = rows.some((row) => row.productId === productId && row.active);

  const bellIcon = (
    <span className="restock-alert-icon" aria-hidden="true">
      <svg
        width="15"
        height="15"
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
            try {
              await save(productId, !active);
            } catch {
              setFailed(true);
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
