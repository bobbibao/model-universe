'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
export default function FinanceDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      className="finance-dialog"
      style={{
        width: 'min(680px, calc(100vw - 24px))',
        maxHeight: '90dvh',
        padding: 0,
        border: '1px solid #e2e8f0',
        borderRadius: 16,
      }}
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="flex items-center justify-between border-b border-slate-200 p-4 font-bold">
        <h2 id={titleId}>{title}</h2>
        <button type="button" aria-label="Đóng / Close" onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
