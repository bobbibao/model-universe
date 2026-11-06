'use client';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import BrandLogo from '@/components/BrandLogo';
import ContactIcon from '@/components/Contact/ContactIcon';
import { CONTACT } from '@/shared/contact-channels';
import { hasTrackingTags, openConsentSettings } from '@/shared/client/utils/consent';
import './store-footer.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

export default function StoreFooter() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');
  const services = useTranslations('services');
  const c = useTranslations('contactHub');
  return (
    <footer className="mu-footer sf">
      <div className="mu-wrap">
        <section className="sf-cta" aria-labelledby="footer-cta">
          <div>
            <h2 id="footer-cta">{c('footerCtaTitle')}</h2>
            <p>{c('footerCtaText')}</p>
          </div>
          <div className="sf-cta-actions">
            <a className="sf-cta-button is-primary" href={CONTACT.tel}>
              <ContactIcon name="phone" size={17} />
              {CONTACT.phoneDisplay}
            </a>
            <a className="sf-cta-button" href={CONTACT.zalo} {...external}>
              <ContactIcon name="zalo" size={24} />
              {c('chatZalo')}
            </a>
            <a className="sf-cta-button" href={CONTACT.messenger} {...external}>
              <ContactIcon name="messenger" size={24} />
              {c('messenger')}
            </a>
          </div>
        </section>

        <div className="sf-grid">
          <div className="sf-about">
            <BrandLogo className="sf-brand" />
            <p>{t('description')}</p>
            <div className="sf-socials">
              <a href={CONTACT.zalo} {...external} aria-label="Zalo">
                <ContactIcon name="zalo" size={34} />
              </a>
              <a href={CONTACT.messenger} {...external} aria-label="Messenger">
                <ContactIcon name="messenger" size={34} />
              </a>
              <a href={CONTACT.facebook} {...external} aria-label="Facebook">
                <svg width="34" height="34" viewBox="0 0 28 28" aria-hidden="true">
                  <circle cx="14" cy="14" r="14" fill="#1877F2" />
                  <path
                    fill="#fff"
                    d="M16.5 14.5l.55-3.5h-3.4v-2.3c0-.95.47-1.87 1.95-1.87h1.5V3.88s-1.37-.23-2.68-.23c-2.74 0-4.53 1.66-4.53 4.66v2.69H6.8V14.5h3.09v8.43a14.07 14.07 0 0 0 3.72 0V14.5h2.89z"
                  />
                </svg>
              </a>
              <a href={CONTACT.tiktok} {...external} aria-label="TikTok">
                <ContactIcon name="tiktok" size={34} />
              </a>
            </div>
          </div>

          <nav aria-labelledby="footer-shop">
            <h2 id="footer-shop">{c('footerShop')}</h2>
            <Link href="/cua-hang">{nav('shop')}</Link>
            <Link href="/uu-dai">{c('footerOffers')}</Link>
            <Link href="/assistant">{nav('assistant')}</Link>
            <Link href="/sellers">{c('footerSellers')}</Link>
            <Link href="/wishlist">{nav('saved')}</Link>
          </nav>

          <nav aria-labelledby="footer-services">
            <h2 id="footer-services">{t('services')}</h2>
            <Link href="/reservations">{nav('holds')}</Link>
            <Link href="/services/sell">{services('buyback')}</Link>
            <Link href="/services/trade">{services('trade')}</Link>
            <Link href="/services/pawn">{services('pawn')}</Link>
            <Link href="/services/loyalty">{services('loyalty')}</Link>
            <Link href="/services/partner">{services('partner')}</Link>
          </nav>

          <nav aria-labelledby="footer-support">
            <h2 id="footer-support">{c('footerSupport')}</h2>
            <Link href="/order-history">{c('footerOrders')}</Link>
            <Link href="/contact">{nav('contact')}</Link>
            <Link href="/about">{nav('about')}</Link>
          </nav>

          <address className="sf-contact" aria-labelledby="footer-contact">
            <h2 id="footer-contact">{c('footerContact')}</h2>
            <a href={CONTACT.tel}>
              <ContactIcon name="phone" size={16} />
              <span>
                <small>{c('hotline')}</small>
                {CONTACT.phoneDisplay}
              </span>
            </a>
            <a href={`mailto:${CONTACT.supportEmail}`}>
              <ContactIcon name="mail" size={16} />
              <span>
                <small>{c('supportEmail')}</small>
                {CONTACT.supportEmail}
              </span>
            </a>
            <a href={CONTACT.mapsUrl} {...external}>
              <ContactIcon name="pin" size={16} />
              <span>
                <small>{c('showroomTitle')}</small>
                {CONTACT.addressLine}
              </span>
            </a>
            <p>
              <ContactIcon name="clock" size={16} />
              <span>
                <small>{c('hours')}</small>
                {c('hoursValue', { hours: CONTACT.hours })}
              </span>
            </p>
          </address>
        </div>

        <div className="sf-bottom">
          <div className="sf-payments">
            <span className="sf-payments-label">{c('footerPayments')}</span>
            <span className="sf-chip">{c('paymentTransfer')}</span>
            <span className="sf-chip">{c('paymentQr')}</span>
            <span className="sf-chip">{c('paymentCod')}</span>
          </div>
          <div className="sf-legal">
            <span>
              © {new Date().getFullYear()} {t('copyright')}
            </span>
            {hasTrackingTags && (
              <button type="button" onClick={openConsentSettings}>
                {t('cookies')}
              </button>
            )}
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              {c('backToTop')} ↑
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
