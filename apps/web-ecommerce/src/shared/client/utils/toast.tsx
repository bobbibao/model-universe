'use client';

import React from 'react';
import { toast as baseToast, ToastOptions, ToastContentProps } from 'react-toastify';

export interface ToastAction {
  label?: string;
  href?: string;
  onClick?: () => void;
}

export interface EnhancedToastOptions extends Omit<ToastOptions, 'content'> {
  title?: string;
  action?: ToastAction;
  href?: string;
}

interface ToastCardProps {
  message: React.ReactNode;
  title?: string;
  action?: ToastAction;
  href?: string;
  type?: 'success' | 'error' | 'info' | 'warning' | 'default';
  closeToast?: () => void;
}

export const ToastCard: React.FC<ToastCardProps> = ({
  message,
  title,
  action,
  href,
  closeToast,
}) => {
  const targetHref = action?.href || href;
  const isInteractive = Boolean(targetHref || action?.onClick);

  const navigateTo = (url: string) => {
    if (typeof window === 'undefined') return;
    const locale = document.documentElement.lang === 'en' ? 'en' : 'vi';
    const destination =
      url.startsWith('http') || url.startsWith(`/${locale}`)
        ? url
        : `/${locale}${url.startsWith('/') ? '' : '/'}${url}`;

    closeToast?.();
    window.location.assign(destination);
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.mu-toast-close')) return;

    if (action?.onClick) {
      e.preventDefault();
      action.onClick();
      closeToast?.();
    } else if (targetHref) {
      e.preventDefault();
      navigateTo(targetHref);
    }
  };

  return (
    <div
      className={`mu-toast-wrapper ${isInteractive ? 'is-navigable' : ''}`}
      onClick={isInteractive ? handleClick : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          if (action?.onClick) {
            action.onClick();
            closeToast?.();
          } else if (targetHref) {
            navigateTo(targetHref);
          }
        }
      }}
    >
      <div className="mu-toast-body-inner">
        <div className="mu-toast-content">
          {title && <div className="mu-toast-title">{title}</div>}
          <div className="mu-toast-message">{message}</div>
        </div>

        {isInteractive && (
          <span className="mu-toast-nav-hint" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mu-toast-nav-icon"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
};

export interface CustomCloseButtonProps {
  closeToast?: (e: React.MouseEvent<HTMLElement>) => void;
  [key: string]: unknown;
}

export const CustomCloseButton = ({ closeToast }: CustomCloseButtonProps) => (
  <button
    type="button"
    className="mu-toast-close"
    onClick={(e) => {
      e.stopPropagation();
      closeToast?.(e);
    }}
    aria-label="Đóng thông báo"
  >
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
);

export const CustomToastIcon = ({ type }: { type?: string }) => {
  switch (type) {
    case 'success':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mu-toast-status-icon is-success"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <polyline points="9 12 11.5 14.5 15.5 9.5" />
        </svg>
      );
    case 'error':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mu-toast-status-icon is-error"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case 'warning':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mu-toast-status-icon is-warning"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mu-toast-status-icon is-info"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
};

/**
 * Strict FIFO Ring Buffer: Holds at most 3 newest toasts.
 * When adding a 4th toast, the oldest toast (at the top/beginning) is dismissed immediately,
 * and the newest toast is appended at the end/bottom.
 */
const MAX_VISIBLE_TOASTS = 3;
const activeToastIds: (string | number)[] = [];

if (typeof window !== 'undefined') {
  baseToast.onChange((toastItem) => {
    if (toastItem.status === 'added') {
      if (!activeToastIds.includes(toastItem.id)) {
        while (activeToastIds.length >= MAX_VISIBLE_TOASTS) {
          const oldestId = activeToastIds.shift();
          if (oldestId !== undefined) {
            baseToast.dismiss(oldestId);
          }
        }
        activeToastIds.push(toastItem.id);
      }
    } else if (toastItem.status === 'removed') {
      const idx = activeToastIds.indexOf(toastItem.id);
      if (idx !== -1) {
        activeToastIds.splice(idx, 1);
      }
    }
  });
}

const renderToast = (
  message: React.ReactNode,
  options?: EnhancedToastOptions,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
) => {
  const { title, action, href, ...restOptions } = options || {};

  // If already at or above limit (3), immediately dismiss the oldest toast from the beginning
  while (activeToastIds.length >= MAX_VISIBLE_TOASTS) {
    const oldestId = activeToastIds.shift();
    if (oldestId !== undefined) {
      baseToast.dismiss(oldestId);
    }
  }

  const content = ({ closeToast }: ToastContentProps) => (
    <ToastCard
      message={message}
      title={title}
      action={action}
      href={href}
      type={type}
      closeToast={closeToast}
    />
  );

  const toastId = baseToast[type](content, {
    ...restOptions,
  });

  if (toastId !== undefined && toastId !== null) {
    if (!activeToastIds.includes(toastId)) {
      activeToastIds.push(toastId);
    }
  }

  return toastId;
};

export const showToast = Object.assign(
  (message: React.ReactNode, options?: EnhancedToastOptions) => renderToast(message, options, 'info'),
  {
    success: (message: React.ReactNode, options?: EnhancedToastOptions) =>
      renderToast(message, options, 'success'),
    error: (message: React.ReactNode, options?: EnhancedToastOptions) =>
      renderToast(message, options, 'error'),
    info: (message: React.ReactNode, options?: EnhancedToastOptions) =>
      renderToast(message, options, 'info'),
    warn: (message: React.ReactNode, options?: EnhancedToastOptions) =>
      renderToast(message, options, 'warning'),
    warning: (message: React.ReactNode, options?: EnhancedToastOptions) =>
      renderToast(message, options, 'warning'),
    dismiss: (id?: string | number) => {
      if (id !== undefined) {
        const idx = activeToastIds.indexOf(id);
        if (idx !== -1) activeToastIds.splice(idx, 1);
        baseToast.dismiss(id);
      } else {
        activeToastIds.length = 0;
        baseToast.dismiss();
      }
    },
    isActive: baseToast.isActive,
    update: baseToast.update,
  },
);

export default showToast;
