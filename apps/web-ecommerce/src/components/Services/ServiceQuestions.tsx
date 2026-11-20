import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import FaqList from '@/components/Faq/FaqList';
import { CONTACT } from '@/shared/contact-channels';
import type { FaqItem } from './serviceFaqItems';

// The questions of one service, on that service's own page: the title and where to ask beside the list on a wide
// screen, above it on a phone. Rendered on the server (FaqList), every answer is in the HTML.
export default function ServiceQuestions({ title, items }: { title: string; items: FaqItem[] }) {
  const g = useTranslations('serviceGuide');
  if (!items.length) return null;
  return (
    <section aria-labelledby="service-questions-title" className="mu-wrap sv-questions">
      <div className="sv-questions-side">
        <h2 id="service-questions-title">{title}</h2>
        <div className="faq-help">
          <strong>{g('faqHelpTitle')}</strong>
          <p>{g('faqHelpText', { hours: CONTACT.hours })}</p>
          <div className="faq-help-actions">
            <a className="is-primary" href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
              {g('guestZalo')}
            </a>
            <a href={CONTACT.tel}>{g('guestCall', { phone: CONTACT.phoneDisplay })}</a>
            <Link className="is-link" href="/contact">
              {g('faqContact')} →
            </Link>
          </div>
        </div>
      </div>
      <FaqList items={items} />
    </section>
  );
}
