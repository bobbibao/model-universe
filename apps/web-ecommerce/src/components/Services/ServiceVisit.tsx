'use client';

import { useTranslations } from 'next-intl';
import ContactIcon from '@/components/Contact/ContactIcon';
import { CONTACT } from '@/shared/contact-channels';

// Where to bring a kit, with the address set large: the showroom's street, its hours and phone, and the three ways
// there (directions, a call, a message on Zalo).
export default function ServiceVisit() {
  const g = useTranslations('serviceGuide');
  return (
    <section className="svc-visit" aria-labelledby="svc-visit-title">
      <div className="svc-visit-copy">
        <h2 id="svc-visit-title">{g('visitTitle')}</h2>
        <a className="svc-visit-address" href={CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer">
          {CONTACT.addressLine}
        </a>
        <dl className="svc-visit-facts">
          <div>
            <dt>
              <ContactIcon name="clock" size={16} />
              {g('visitHoursLabel')}
            </dt>
            <dd>{g('visitHoursValue', { hours: CONTACT.hours })}</dd>
          </div>
          <div>
            <dt>
              <ContactIcon name="phone" size={16} />
              {g('visitPhoneLabel')}
            </dt>
            <dd>
              <a href={CONTACT.tel}>{CONTACT.phoneDisplay}</a>
            </dd>
          </div>
        </dl>
      </div>
      <div className="svc-visit-actions">
        <a className="svx-button is-primary" href={CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer">
          <ContactIcon name="pin" size={18} />
          {g('visitDirections')}
        </a>
        <a className="svx-button is-outline" href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
          <ContactIcon name="zalo" size={22} />
          {g('guestZalo')}
        </a>
        <a className="svx-button is-outline" href={CONTACT.tel}>
          <ContactIcon name="phone" size={18} />
          {g('guestCall', { phone: CONTACT.phoneDisplay })}
        </a>
      </div>
    </section>
  );
}
