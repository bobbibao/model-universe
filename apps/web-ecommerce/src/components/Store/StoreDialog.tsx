'use client';

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import './store-dialog.css';

// A storefront dialog: a centred card on wide screens, a sheet that rises from the bottom on phones. It is a native
// <dialog> opened as a modal (focus stays inside, Escape closes, the page behind is inert and does not scroll), and a
// click on the backdrop closes it. The header holds the title and the close button; the footer stays in view.
export default function StoreDialog({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 560,
  className = '',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  className?: string;
}) {
  const t = useTranslations('common');
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`store-dialog ${className}`.trim()}
      style={{ '--store-dialog-width': `${width}px` } as CSSProperties}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="store-dialog-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button type="button" className="store-dialog-close" aria-label={t('close')} onClick={onClose}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>
      <div className="store-dialog-body">{children}</div>
      {footer && <footer className="store-dialog-foot">{footer}</footer>}
    </dialog>
  );
}
