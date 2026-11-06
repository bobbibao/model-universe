'use client';

import { useTranslations } from 'next-intl';
import { CONTACT, messengerWithText } from '@/shared/contact-channels';
import ContactIcon from './ContactIcon';
import './contact.css';

// "Questions about this kit?" next to the buy controls: the fastest channels, Messenger pre-filled with the kit name.
export default function ProductContactHelp({ productName }: { productName: string }) {
  const c = useTranslations('contactHub');
  return (
    <div className="ch-product-help">
      <div className="ch-product-help-copy">
        <strong>{c('productHelpTitle')}</strong>
        <span>{c('productHelpText')}</span>
      </div>
      <div className="ch-product-help-actions">
        <a className="ch-pill" href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
          <ContactIcon name="zalo" size={28} />
          {c('zalo')}
        </a>
        <a
          className="ch-pill"
          href={messengerWithText(c('productMessage', { name: productName }))}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ContactIcon name="messenger" size={28} />
          {c('messenger')}
        </a>
        <a className="ch-pill" href={CONTACT.tel}>
          <span className="ch-pill-phone">
            <ContactIcon name="phone" size={15} />
          </span>
          {CONTACT.phoneDisplay}
        </a>
      </div>
    </div>
  );
}
