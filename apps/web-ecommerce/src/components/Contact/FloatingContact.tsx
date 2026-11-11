'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { CONTACT } from '@/shared/contact-channels';
import ContactIcon from './ContactIcon';
import './contact.css';

// Pages that already show the contact channels, or keep the bottom of the screen for their own actions.
const HIDDEN_ON = ['/contact', '/cart', '/assistant', '/thank-you'];

export default function FloatingContact() {
  const c = useTranslations('contactHub');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  if (HIDDEN_ON.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;
  const raised = pathname.startsWith('/san-pham/');

  return (
    <div ref={root} className={`ch-fab${raised ? ' is-raised' : ''}`} data-open={String(open)}>
      <button
        type="button"
        className="ch-fab-toggle"
        aria-expanded={open}
        aria-controls="quick-contact"
        aria-label={open ? c('floatingClose') : c('floatingOpen')}
        onClick={() => setOpen(!open)}
      >
        <span className="ch-fab-ring">
          <ContactIcon name={open ? 'close' : 'phone'} size={20} />
        </span>
        <span className="ch-fab-label">{c('floatingOpen')}</span>
      </button>
      {open && (
        <nav id="quick-contact" className="ch-fab-menu" aria-label={c('floatingOpen')}>
          <a href={CONTACT.tel}>
            <span className="ch-fab-phone">
              <ContactIcon name="phone" size={18} />
            </span>
            <span>
              <strong>{c('callHotline')}</strong>
              <small>{CONTACT.phoneDisplay}</small>
            </span>
          </a>
          <a href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
            <ContactIcon name="zalo" size={36} />
            <span>
              <strong>{c('chatZalo')}</strong>
              <small>{c('fastestReply')}</small>
            </span>
          </a>
          <a href={CONTACT.messenger} target="_blank" rel="noopener noreferrer">
            <ContactIcon name="messenger" size={36} />
            <span>
              <strong>{c('chatMessenger')}</strong>
              <small>{c('openHours', { hours: CONTACT.hours })}</small>
            </span>
          </a>
        </nav>
      )}
    </div>
  );
}
