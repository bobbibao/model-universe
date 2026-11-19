'use client';

import { useTranslations } from 'next-intl';
import AdminIcon from '@/components/Admin/AdminIcon';
import ContactIcon from '@/components/Contact/ContactIcon';
import { CONTACT } from '@/shared/contact-channels';

// Where to bring a kit, on one card: the showroom's address (a link to the map), its hours and phone, and the three
// ways there (directions, a message on Zalo, a call).
export default function ServiceVisit() {
  const g = useTranslations('serviceGuide');
  return (
    <section className="svc-visit" aria-labelledby="svc-visit-title">
      <span className="svc-visit-icon" aria-hidden="true">
        <ContactIcon name="pin" size={24} />
      </span>
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
          {g('visitDirections')}
          <AdminIcon name="arrow" size={18} />
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
