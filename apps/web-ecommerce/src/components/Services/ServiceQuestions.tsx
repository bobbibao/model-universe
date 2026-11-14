import type { FaqItem } from './serviceFaqItems';

// The questions of one service, on that service's own page. Rendered on the server as plain <details>: every answer
// is in the HTML (the page's FAQPage data repeats exactly this text) and it works without JavaScript.
export default function ServiceQuestions({ title, items }: { title: string; items: FaqItem[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="service-questions-title" className="mx-auto max-w-4xl px-4 pb-12 pt-4 text-slate-800">
      <h2 id="service-questions-title" className="text-2xl font-semibold text-slate-900">
        {title}
      </h2>
      <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {items.map((item, index) => (
          <details key={item.id} id={`hoi-dap-${item.id}`} className="group p-5" open={index === 0}>
            <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">
              <h3 className="inline">{item.question}</h3>
            </summary>
            <p className="mt-3 leading-relaxed">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
