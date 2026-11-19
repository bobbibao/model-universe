'use client';

import { useTranslations } from 'next-intl';
import { SERVICE_FACTS } from './serviceFacts';

// The three numbers people ask first, set large: the top buyback price, the pawn amount and how long a deposit holds
// a kit. A still statement, no counting.
export default function ServiceFigures() {
  const g = useTranslations('serviceGuide');
  const figures = [
    { value: `${SERVICE_FACTS.sellMaxPercent}%`, label: g('statSell') },
    { value: `${SERVICE_FACTS.pawnPercent}%`, label: g('statPawn') },
    { value: `${SERVICE_FACTS.holdMinDays}–${SERVICE_FACTS.holdMaxDays}`, label: g('statHold') },
  ];
  return (
    <section className="svc-figures" aria-label={g('figuresLabel')}>
      <dl>
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt>{figure.label}</dt>
            <dd>{figure.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
