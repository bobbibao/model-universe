'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

// The request form of a service page, revealed below the quick valuation: it fades in, scrolls smoothly into view and
// focuses the model name when it must be typed, so the customer sees where to continue. `revision` changes with each
// new request.
export default function ServiceRequestPanel({
  revision,
  onClose,
  children,
}: {
  revision: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('buyback');
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = root.current;
    if (!panel) return;
    const frame = requestAnimationFrame(() => {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      panel.querySelector<HTMLElement>('input[name="name"]')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [revision]);
  return (
    <div ref={root} key={revision} className="service-request-panel" role="region" aria-label={t('requestTitle')}>
      <div className="service-request-panel-head">
        <h2>{t('requestTitle')}</h2>
        <button type="button" className="text-sm underline" onClick={onClose}>
          {t('requestClose')}
        </button>
      </div>
      {children}
    </div>
  );
}
