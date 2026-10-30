'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

// Toggle rows deliberately stay open after selection, including while URL filters refresh.
export default function FilterMultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder,
  clearLabel,
  inline = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  clearLabel?: string;
  inline?: boolean;
}) {
  const t = useTranslations('catalog');
  const common = useTranslations('common');
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || inline) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, inline]);
  const chosen = values.map((value) => options.find((option) => option.value === value)?.label || value);
  return (
    <div
      className={`filter-multi${inline ? ' is-inline' : ''}`}
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        // Clearing disables the focused button and can emit blur with no next target.
        // Keep the menu open; outside pointer clicks and focus moving outside still close it.
        if (!inline && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span className="mu-field" id={`${id}-label`}>
        {label}
      </span>
      <button
        type="button"
        ref={trigger}
        className="filter-multi-trigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => setOpen(!open)}
      >
        <span id={`${id}-value`} title={chosen.join(', ')}>
          {chosen.length ? chosen.join(', ') : (placeholder ?? t('all'))}
        </span>
        {chosen.length > 0 && <b aria-hidden="true">{chosen.length}</b>}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="m4 6 4 4 4-4" strokeWidth="1.8" />
        </svg>
      </button>
      {open && (
        <div className="filter-multi-menu" id={`${id}-options`} role="group" aria-labelledby={`${id}-label`}>
          <div className="filter-multi-options">
            {[
              ...options,
              ...values
                .filter((value) => !options.some((option) => option.value === value))
                .map((value) => ({ value, label: value })),
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={values.includes(option.value)}
                disabled={values.length >= 50 && !values.includes(option.value)}
                onClick={() =>
                  onChange(
                    values.includes(option.value)
                      ? values.filter((value) => value !== option.value)
                      : [...values, option.value],
                  )
                }
              >
                <span>{option.label}</span>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="m4 10 4 4 8-8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
          <div className="filter-multi-footer">
            <button type="button" disabled={!values.length} onClick={() => onChange([])}>
              {clearLabel ?? t('all')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              {common('close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
