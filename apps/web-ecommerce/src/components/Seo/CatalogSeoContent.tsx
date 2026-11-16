import Link from '@/i18n/navigation';
import type { ProductSummary } from '@/shared/types/product';
import { formatVND } from '@/shared/server/utils/utils';
import {
  BUSINESS,
  categoryKitName,
  faqSchema,
  familyCanonicals,
  isEnglish,
  jsonLd,
  productConditionLabel,
  shippingOfferText,
} from '@/shared/seo';

const CHINESE_KITS_GUIDE = '/huong-dan/kit-trung-quoc-motor-nuclear-cangdao-moshow';

// The questions a catalog page answers, from its own listing: prices are the lowest and highest a customer pays today
// (computed here, never written by hand), the rest repeats the shop facts of the home page FAQ.
export function catalogFaq(locale: string, kit: string, products: readonly ProductSummary[]) {
  const en = isEnglish(locale);
  const prices = products.map((product) => product.salePrice || product.price).filter((price) => price > 0);
  const address = `${BUSINESS.streetAddress}, ${BUSINESS.locality}, ${BUSINESS.region}`;
  const range = prices.length
    ? `${formatVND(Math.min(...prices), locale)} – ${formatVND(Math.max(...prices), locale)}`
    : undefined;
  const lower = kit.replace(/^Mô hình/, 'mô hình');
  const line = /^Mô hình /.test(kit) && kit !== 'Mô hình lắp ráp' ? kit.replace(/^Mô hình /, '') : 'mô hình';
  const items = en
    ? [
        {
          question: `Where can I buy ${kit} model kits in Ho Chi Minh City?`,
          answer: `Model Universe (Vũ Trụ Mô Hình) at ${address} (Go Vap) lists ${products.length} ${kit} kits, new and pre-owned. See a kit in person by appointment or order online with cash on delivery across Vietnam and ${shippingOfferText(locale)}.`,
        },
        ...(range
          ? [{ question: `How much does a ${kit} kit cost at Model Universe?`, answer: `The kits listed today cost ${range}, depending on the model and its condition. Each product page shows the price you pay.` }]
          : []),
        {
          question: `How is the condition of a pre-owned ${kit} kit described?`,
          answer: 'Every pre-owned listing states its condition: whether the box is included, whether accessories are complete and whether the kit is built or unbuilt.',
        },
        {
          question: `Does the shop buy or trade ${kit} kits?`,
          answer: 'Yes. Model Universe buys model kits, trades them and helps you sell off a collection. Send photos through the buyback form or Zalo to get a quote.',
        },
      ]
    : [
        {
          question: `Mua ${lower} ở đâu tại TP.HCM?`,
          answer: `Model Universe (Vũ Trụ Mô Hình) ở ${address} (Gò Vấp) đang có ${products.length} mẫu ${lower} New và 2hand. Bạn có thể hẹn xem hàng trực tiếp hoặc đặt online, giao COD toàn quốc và ${shippingOfferText(locale)}.`,
        },
        ...(range
          ? [{ question: `Giá ${lower} tại shop bao nhiêu?`, answer: `Các mẫu đang bán có giá từ ${range} tùy mẫu và tình trạng. Giá bạn trả được ghi trên từng trang sản phẩm.` }]
          : []),
        {
          question: `Hàng 2hand ${line} được ghi tình trạng thế nào?`,
          answer: 'Mỗi sản phẩm 2hand đều ghi rõ tình trạng: còn hộp hay không, đủ hay thiếu phụ kiện, đã ráp hay chưa ráp.',
        },
        {
          question: `Shop có thu mua, trade ${lower} không?`,
          answer: 'Có. Model Universe thu mua mô hình, nhận trade (trao đổi) và hỗ trợ thanh lý bộ sưu tập. Gửi ảnh qua form thu mua hoặc Zalo để được báo giá.',
        },
      ];
  return items;
}

// Below the interactive catalog: what the page sells in words and every model on it as a plain link, so crawlers that
// do not run JavaScript (AI answer engines, Bing) see the products, and a FAQ whose FAQPage data repeats the visible text.
export default function CatalogSeoContent({
  locale,
  products,
  category,
}: {
  locale: string;
  products: readonly ProductSummary[];
  category?: { name: string; description?: string | null };
}) {
  const en = isEnglish(locale);
  const kit = category ? categoryKitName(category.name, locale) : en ? 'model kits' : 'Mô hình lắp ráp';
  const models = familyCanonicals(products.filter((product) => product.slug));
  const faq = catalogFaq(locale, kit, models);
  const intro =
    category?.description?.trim() ||
    (en
      ? `${kit} at Model Universe (Vũ Trụ Mô Hình), the model kit shop in Go Vap, Ho Chi Minh City: new and pre-owned kits, each with its condition stated, cash on delivery across Vietnam.`
      : `${kit} New và 2hand tại Model Universe (Vũ Trụ Mô Hình), shop mô hình lắp ráp ở Gò Vấp, TP.HCM: mỗi mẫu ghi rõ tình trạng, giá minh bạch, giao COD toàn quốc.`);

  return (
    <section className="mu-wrap mu-section catalog-seo" aria-labelledby="catalog-seo-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(faq)) }} />
      <h2 id="catalog-seo-title" className="mu-heading">
        {en ? `${kit} in stock` : `${kit} đang có tại shop`}
      </h2>
      <p>{intro}</p>
      {models.length > 0 && (
        <ul className="catalog-seo-list">
          {models.map((product) => (
            <li key={product.id}>
              <Link href={`/san-pham/${product.slug}`}>{product.name}</Link>
              {' – '}
              {productConditionLabel(product, locale)}, {formatVND(product.salePrice || product.price, locale)}
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link href={CHINESE_KITS_GUIDE}>
          {en ? 'What are Chinese model kits? Motor Nuclear, CangDao and Moshow compared with Gunpla' : 'Kit Trung Quốc là gì? Motor Nuclear, CangDao, Moshow khác gì Gunpla'}
        </Link>
      </p>
      <div className="home-about-faq">
        <h2>{en ? 'Frequently asked questions' : 'Câu hỏi thường gặp'}</h2>
        {faq.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
