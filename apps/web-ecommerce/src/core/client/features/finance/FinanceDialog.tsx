'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';

export interface FinanceDialogProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number | string;
  bodyClassName?: string;
}

export default function FinanceDialog({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = 640,
  bodyClassName,
}: FinanceDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    // Scroll lock on body to prevent page scrolling behind dialog
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      className="finance-dialog"
      style={{
        width: `min(${typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth}, calc(100vw - 24px))`,
        maxHeight: 'min(90dvh, 780px)',
        padding: 0,
        margin: 'auto',
      }}
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => {
        // Close on clicking backdrop outside modal card
        if (e.target === ref.current) {
          onClose();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="finance-dialog-header">
        <div className="finance-dialog-header-info">
          <h2 id={titleId} className="finance-dialog-title">
            {title}
          </h2>
          {subtitle && <p className="finance-dialog-subtitle">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="finance-dialog-close-btn"
          aria-label="Đóng / Close"
          onClick={onClose}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </header>

      <div className={`finance-dialog-body ${bodyClassName || ''}`}>{children}</div>

      {footer && <footer className="finance-dialog-footer">{footer}</footer>}
    </dialog>
  );
}
