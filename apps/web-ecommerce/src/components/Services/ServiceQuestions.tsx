import type { FaqItem } from './serviceFaqItems';

// The questions of one service, on that service's own page. Rendered on the server as plain <details>: every answer
// is in the HTML (the page's FAQPage data repeats exactly this text) and it works without JavaScript.
export default function ServiceQuestions({ title, items }: { title: string; items: FaqItem[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="service-questions-title" className="mu-wrap sv-questions pb-14">
      <h2 id="service-questions-title">{title}</h2>
      <div className="sv-questions-list">
        {items.map((item, index) => (
          <details key={item.id} id={`hoi-dap-${item.id}`} open={index === 0}>
            <summary>
              <h3>{item.question}</h3>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
