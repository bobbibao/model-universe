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
  return (
    <div className="restock-action">
      {!user ? (
        <Link
          className={className}
          href={'/auth/signin?redirect=' + encodeURIComponent(returnTo || '/shop/product/' + productId)}
        >
          {t('startAlert')}
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
          {active ? t('stopAlert') : t('startAlert')}
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
