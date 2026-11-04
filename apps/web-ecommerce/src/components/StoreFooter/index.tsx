'use client';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import BrandLogo from '@/components/BrandLogo';
import { hasTrackingTags, openConsentSettings } from '@/shared/client/utils/consent';
export default function StoreFooter() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');
  const services = useTranslations('services');
  return (
    <footer className="mu-footer">
      <div className="mu-wrap">
        <div className="mu-footer-grid">
          <div>
            <BrandLogo className="text-white [&>svg]:text-brand" />
            <p className="mt-5 max-w-sm text-sm leading-7 text-store-muted">{t('description')}</p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://zalo.me/0373725104"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Zalo"
                className="inline-flex transition-transform hover:scale-110"
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-full shadow-xs">
                  <circle cx="14" cy="14" r="14" fill="#0068FF" />
                  <g transform="translate(4, 8) scale(0.67)">
                    <path
                      d="M12.49 10.272v-.45h1.347v6.322h-.77a.576.576 0 0 1-.577-.573v.001a3.27 3.27 0 0 1-1.938.632a3.284 3.284 0 0 1-3.284-3.282a3.284 3.284 0 0 1 3.284-3.282a3.27 3.27 0 0 1 1.937.632zM6.919 7.79v.205c0 .382-.051.694-.3 1.06l-.03.034a8 8 0 0 0-.242.285L2.024 14.8h4.895v.768a.576.576 0 0 1-.577.576H0v-.362c0-.443.11-.641.25-.847L4.858 9.23H.192V7.79zm8.551 8.354a.48.48 0 0 1-.48-.48V7.79h1.441v8.354zM20.693 9.6a3.306 3.306 0 1 1 .002 6.612a3.306 3.306 0 0 1-.002-6.612m-10.14 5.253a1.932 1.932 0 1 0 0-3.863a1.932 1.932 0 0 0 0 3.863m10.14-.003a1.945 1.945 0 1 0 0-3.89a1.945 1.945 0 0 0 0 3.89"
                      fill="#FFFFFF"
                    />
                  </g>
                </svg>
              </a>
              <a
                href="https://www.facebook.com/modeluniverse.vn"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="inline-flex transition-transform hover:scale-110"
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-full shadow-xs">
                  <circle cx="14" cy="14" r="14" fill="#1877F2" />
                  <path
                    d="M16.5 14.5l.55-3.5h-3.4v-2.3c0-.95.47-1.87 1.95-1.87h1.5V3.88s-1.37-.23-2.68-.23c-2.74 0-4.53 1.66-4.53 4.66v2.69H6.8V14.5h3.09v8.43a14.07 14.07 0 0 0 3.72 0V14.5h2.89z"
                    fill="#FFFFFF"
                  />
                </svg>
              </a>
              <a
                href="https://www.tiktok.com/@model.universe.c"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="inline-flex transition-transform hover:scale-110"
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-full shadow-xs">
                  <circle cx="14" cy="14" r="14" fill="#000000" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <path
                    d="M17.8 8.6a4.2 4.2 0 0 1-2.9-1.3v7.4a4.3 4.3 0 1 1-3.7-4.25v2.3a2 2 0 1 0 1.4 1.95V4.5h2.3a4.2 4.2 0 0 0 2.9 2.5v1.6z"
                    fill="#25F4EE"
                    transform="translate(-0.8, -0.6)"
                  />
                  <path
                    d="M17.8 8.6a4.2 4.2 0 0 1-2.9-1.3v7.4a4.3 4.3 0 1 1-3.7-4.25v2.3a2 2 0 1 0 1.4 1.95V4.5h2.3a4.2 4.2 0 0 0 2.9 2.5v1.6z"
                    fill="#FE2C55"
                    transform="translate(0.8, 0.6)"
                  />
                  <path
                    d="M17.8 8.6a4.2 4.2 0 0 1-2.9-1.3v7.4a4.3 4.3 0 1 1-3.7-4.25v2.3a2 2 0 1 0 1.4 1.95V4.5h2.3a4.2 4.2 0 0 0 2.9 2.5v1.6z"
                    fill="#FFFFFF"
                  />
                </svg>
              </a>
            </div>
          </div>
          <div>
            <h2 className="mb-5 font-bold">{t('explore')}</h2>
            <div className="flex flex-col gap-4 text-sm text-store-muted">
              <Link href="/cua-hang">{nav('shop')}</Link>
              <Link href="/assistant">{nav('assistant')}</Link>
              <Link href="/wishlist">{nav('saved')}</Link>
              <Link href="/about">{nav('about')}</Link>
              <Link href="/contact">{nav('contact')}</Link>
            </div>
          </div>
          <div>
            <h2 className="mb-5 font-bold">{t('services')}</h2>
            <div className="flex flex-col gap-4 text-sm text-store-muted">
              <Link href="/reservations">{nav('holds')}</Link>
              <Link href="/services/sell">{services('buyback')}</Link>
              <Link href="/services/trade">{services('trade')}</Link>
              <Link href="/services/pawn">{services('pawn')}</Link>
              <Link href="/services/loyalty">{services('loyalty')}</Link>
              <Link href="/services/partner">{services('partner')}</Link>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap justify-between gap-4 border-t border-white/10 pt-6 text-xs text-store-muted">
          <span>
            © {new Date().getFullYear()} {t('copyright')}
          </span>
          {hasTrackingTags && <button onClick={openConsentSettings}>{t('cookies')}</button>}
        </div>
      </div>
    </footer>
  );
}
