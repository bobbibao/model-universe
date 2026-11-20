import './faq.css';
import FaqAnswer from './FaqAnswer';

export type FaqEntry = { id: string; question: string; answer: string };

// Questions and answers as one ruled list of <details>: rendered on the server, every answer is in the HTML (the
// page's FAQPage data repeats exactly this text) and it works without JavaScript. A round plus turns into a minus on
// the open question; where the browser can animate it, the answer slides open.
export default function FaqList({
  items,
  openFirst = true,
  idPrefix = 'hoi-dap',
}: {
  items: FaqEntry[];
  openFirst?: boolean;
  idPrefix?: string;
}) {
  return (
    <div className="faq-list">
      {items.map((item, index) => (
        <details key={item.id} id={`${idPrefix}-${item.id}`} className="faq-item" open={openFirst && index === 0}>
          <summary>
            <h3>{item.question}</h3>
            <span className="faq-icon" aria-hidden="true" />
          </summary>
          <FaqAnswer text={item.answer} />
        </details>
      ))}
    </div>
  );
}
