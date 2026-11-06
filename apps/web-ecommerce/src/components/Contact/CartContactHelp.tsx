'use client';

import { useTranslations } from 'next-intl';
import { CONTACT } from '@/shared/contact-channels';
import ContactIcon from './ContactIcon';
import './contact.css';

// Under the order summary: who to call when checkout gets stuck (the floating contact button is hidden on the cart).
export default function CartContactHelp() {
  const c = useTranslations('contactHub');
  return (
    <div className="ch-cart-help">
      <p>{c('cartHelp', { phone: CONTACT.phoneDisplay })}</p>
      <div className="ch-product-help-actions">
        <a className="ch-pill" href={CONTACT.tel}>
          <span className="ch-pill-phone">
            <ContactIcon name="phone" size={15} />
          </span>
          {c('call')}
        </a>
        <a className="ch-pill" href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
          <ContactIcon name="zalo" size={28} />
          {c('zalo')}
        </a>
      </div>
    </div>
  );
}
