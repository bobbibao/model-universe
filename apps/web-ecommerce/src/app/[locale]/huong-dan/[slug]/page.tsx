import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Link from '@/i18n/navigation';
import { CUSTOMER_ASSISTANT_ENABLED } from '@/shared/customer-assistant-policy';
import { findGuide } from '@/shared/guides';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { articleSchema, breadcrumbSchema, faqSchema, jsonLd, pageMetadata } from '@/shared/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();
  return pageMetadata(siteUrl(), {
    locale,
    path: `/huong-dan/${guide.slug}`,
    title: guide.title,
    description: guide.description,
  });
}

// Rendered per request like every storefront page (the layout reads the visitor's session).
// One guide: the direct answer first (what a search or AI answer quotes), then the sections, its questions and the
// shop pages it leads to. Article, FAQPage and BreadcrumbList data describe the same visible text.
export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();
  const base = siteUrl();

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            articleSchema(base, locale, guide),
            faqSchema(guide.questions),
            breadcrumbSchema(base, locale, [
              ['Hướng dẫn', '/huong-dan'],
              [guide.title, `/huong-dan/${guide.slug}`],
            ]),
          ]),
        }}
      />
      <article className="mx-auto max-w-3xl px-4 py-10 text-slate-800">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Trang chủ
          </Link>
          {' / '}
          <Link href="/huong-dan" className="hover:underline">
            Hướng dẫn
          </Link>
        </nav>
        <h1 className="text-3xl font-bold leading-tight text-slate-900">{guide.title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Model Universe · Cập nhật <time dateTime={guide.updated}>{guide.updated.split('-').reverse().join('/')}</time>
        </p>
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-lg leading-relaxed">
          {guide.answer}
        </p>

        {guide.sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="text-xl font-semibold text-slate-900">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 leading-relaxed">
                {paragraph}
              </p>
            ))}
            {section.list && (
              <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900">Câu hỏi thường gặp</h2>
          {guide.questions.map((item) => (
            <div key={item.question} className="mt-4">
              <h3 className="font-semibold text-slate-900">{item.question}</h3>
              <p className="mt-1 leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Xem tiếp</h2>
          <ul className="mt-3 space-y-2">
            {guide.related.filter((link) => CUSTOMER_ASSISTANT_ENABLED || link.path !== '/assistant').map((link) => (
              <li key={link.path}>
                <Link href={link.path} className="font-medium text-primary hover:underline">
                  {link.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </StoreLayout>
  );
}
