'use client';

import React from 'react';
import { toast as baseToast, ToastOptions, ToastContentProps } from 'react-toastify';

export interface ToastAction {
  label: string;
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

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;

    if (targetHref) {
      e.preventDefault();
      navigateTo(targetHref);
    }
  };

  return (
    <div
      className={`mu-toast-wrapper ${targetHref ? 'is-navigable' : ''}`}
      onClick={handleCardClick}
      role={targetHref ? 'link' : undefined}
      tabIndex={targetHref ? 0 : undefined}
      onKeyDown={(e) => {
        if (targetHref && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          navigateTo(targetHref);
        }
      }}
    >
      <div className="mu-toast-inner">
        <div className="mu-toast-content">
          {title && <div className="mu-toast-title">{title}</div>}
          <div className="mu-toast-message">{message}</div>
        </div>

        {action && (
          <div className="mu-toast-action-container">
            <button
              type="button"
              className="mu-toast-action-pill"
              onClick={(e) => {
                e.stopPropagation();
                if (action.onClick) {
                  action.onClick();
                  closeToast?.();
                } else if (action.href) {
                  navigateTo(action.href);
                }
              }}
            >
              <span>{action.label}</span>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mu-toast-arrow"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {targetHref && !action && (
        <span className="mu-toast-hint">
          Bấm để xem chi tiết
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      )}
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
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
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
        <span className="mu-toast-icon-wrap is-success">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      );
    case 'error':
      return (
        <span className="mu-toast-icon-wrap is-error">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      );
    case 'warning':
      return (
        <span className="mu-toast-icon-wrap is-warning">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      );
    case 'info':
    default:
      return (
        <span className="mu-toast-icon-wrap is-info">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.247.25v3.25a.75.75 0 001.5 0v-3.5A1.75 1.75 0 009.25 9H9z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      );
  }
};

const renderToast = (
  message: React.ReactNode,
  options?: EnhancedToastOptions,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
) => {
  const { title, action, href, ...restOptions } = options || {};

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

  return baseToast[type](content, {
    ...restOptions,
  });
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
    dismiss: baseToast.dismiss,
    isActive: baseToast.isActive,
    update: baseToast.update,
  },
);

export default showToast;
