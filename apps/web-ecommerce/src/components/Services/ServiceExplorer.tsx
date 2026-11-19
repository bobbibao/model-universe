'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ContactIcon from '@/components/Contact/ContactIcon';
import { CONTACT } from '@/shared/contact-channels';
import { SERVICE_FACTS } from './serviceFacts';
import { collectorServices, useServiceFact, type CollectorService } from './ServiceExperience';

type GuideService = Exclude<CollectorService, 'loyalty'>;
const KEYS = collectorServices.map((service) => service.key as GuideService);
const CTA = {
  sell: 'ctaSell',
  trade: 'ctaTrade',
  pawn: 'ctaPawn',
  partner: 'ctaPartner',
  reserve: 'ctaReserve',
} as const;
const TRUST = ['trustRules', 'trustTracking', 'trustMoney'] as const;
// The number a service is chosen for, from the pricing rules; trade and partner lead with their key fact instead.
const FIGURES: Partial<Record<GuideService, { value: string; label: 'statSell' | 'statPawn' | 'statHold' }>> = {
  sell: { value: `${SERVICE_FACTS.sellMaxPercent}%`, label: 'statSell' },
  pawn: { value: `${SERVICE_FACTS.pawnPercent}%`, label: 'statPawn' },
  reserve: { value: `${SERVICE_FACTS.holdMinDays}–${SERVICE_FACTS.holdMaxDays}`, label: 'statHold' },
};
const NUMBERS = {
  percent: SERVICE_FACTS.holdMinPercent,
  minDays: SERVICE_FACTS.holdMinDays,
  maxDays: SERVICE_FACTS.holdMaxDays,
};
const order = (index: number) => ({ '--i': index }) as CSSProperties;

// On a phone the tiles scroll sideways: centre the chosen one in its row without moving the page.
function centreTile(row: HTMLElement | null, key: GuideService) {
  const tile = document.getElementById(`svc-tab-${key}`);
  if (!row || !tile || row.scrollWidth <= row.clientWidth) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  row.scrollTo({
    left: tile.offsetLeft - (row.clientWidth - tile.offsetWidth) / 2,
    behavior: still ? 'auto' : 'smooth',
  });
}

// The services hub as one picker and one card, so every service is one click away and the page stays short: five
// tiles (icon, name, key fact) choose the service; the card under them shows it: what it does, its four steps and the
// way in, beside a navy card with the number it is chosen for and its promise, and the shop's rules under that. All
// five cards are rendered in the same grid cell, so
// the card keeps one height and switching moves nothing on the page; the new service's words rise in. The choice
// follows the URL hash (#sell, #pawn…) so a link can open a service, and the tiles are tabs (arrow keys, Home, End).
export default function ServiceExplorer() {
  const t = useTranslations('experience');
  const g = useTranslations('serviceGuide');
  const fact = useServiceFact();
  const [active, setActive] = useState<GuideService>('sell');
  const [moved, setMoved] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as GuideService;
    if (!KEYS.includes(fromHash)) return;
    setActive(fromHash);
    centreTile(row.current, fromHash);
    root.current?.scrollIntoView({ block: 'start' });
  }, []);

  const choose = (key: GuideService, focus = false) => {
    setActive(key);
    setMoved(true);
    window.history.replaceState(window.history.state, '', `#${key}`);
    centreTile(row.current, key);
    if (focus) document.getElementById(`svc-tab-${key}`)?.focus();
  };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = KEYS.indexOf(active);
    const target: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: KEYS.length - 1,
    };
    if (!(event.key in target)) return;
    event.preventDefault();
    choose(KEYS[(target[event.key] + KEYS.length) % KEYS.length], true);
  };

  return (
    <div className="svc-explorer" ref={root} data-moved={moved || undefined}>
      <div className="svc-picker" role="tablist" aria-label={t('hubTitle')} ref={row}>
        {collectorServices.map((item) => {
          const key = item.key as GuideService;
          const selected = key === active;
          return (
            <button
              key={key}
              id={`svc-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`svc-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              className="svc-tile"
              onClick={() => choose(key)}
              onKeyDown={onKey}
            >
              <span className="svc-tile-icon" aria-hidden="true">
                <AdminIcon name={item.icon} size={20} />
              </span>
              <span className="svc-tile-name">{t(`serviceNames.${key}`)}</span>
              <span className="svc-tile-fact">{fact(key)}</span>
            </button>
          );
        })}
      </div>

      <div className="svc-stage">
        {collectorServices.map((item) => {
          const key = item.key as GuideService;
          const shown = key === active;
          const figure = FIGURES[key];
          return (
            <div
              key={key}
              id={`svc-panel-${key}`}
              role="tabpanel"
              aria-labelledby={`svc-tab-${key}`}
              className="svc-panel"
              data-active={shown}
              inert={!shown}
            >
              <div className="svc-main">
                <h3 className="svc-in" style={order(0)}>
                  {t(`serviceNames.${key}`)}
                </h3>
                <p className="svc-summary svc-in" style={order(1)}>
                  {t(`serviceSummary.${key}`)}
                </p>
                <h4 className="svc-label">{g('guestTitle')}</h4>
                <ol className="svc-steps">
                  {[1, 2, 3, 4].map((step) => (
                    <li key={step} className="svc-in" style={order(step + 1)}>
                      <span className="svc-step-num" aria-hidden="true">
                        {step}
                      </span>
                      <span>{g(`${key}Step${step}`, NUMBERS)}</span>
                    </li>
                  ))}
                </ol>
                <div className="svc-actions">
                  <Link href={item.route} className="svx-button is-primary">
                    {g(CTA[key])}
                    <AdminIcon name="arrow" size={18} />
                  </Link>
                  <a className="svx-button is-outline" href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
                    <ContactIcon name="zalo" size={22} />
                    {g('guestZalo')}
                  </a>
                </div>
              </div>
              <aside className="svc-aside">
                <div className="svc-card">
                  {figure ? (
                    <p className="svc-figure svc-in" style={order(1)}>
                      <strong>{figure.value}</strong>
                      <span>{g(figure.label)}</span>
                    </p>
                  ) : (
                    <p className="svc-statement svc-in" style={order(1)}>
                      {fact(key)}
                    </p>
                  )}
                  <p className="svc-promise svc-in" style={order(2)}>
                    <AdminIcon name="check" size={18} />
                    {g(`${key}Fact2`)}
                  </p>
                </div>
                <div className="svc-trust">
                  <h4>{g('trustTitle')}</h4>
                  <ul>
                    {TRUST.map((rule) => (
                      <li key={rule}>
                        <AdminIcon name="check" size={16} />
                        {g(rule)}
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          );
        })}
      </div>
    </div>
  );
}
