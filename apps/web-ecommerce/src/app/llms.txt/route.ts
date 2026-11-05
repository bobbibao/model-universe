import { getPublicCategories, isIndexableCategory } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { BUSINESS, SHOP_SERVICES, SITE_ALTERNATE_NAMES, SITE_NAME, SITE_SLOGAN, shippingOfferText } from '@/shared/seo';

export const dynamic = 'force-dynamic';

// /llms.txt: a plain summary of the shop for AI assistants and answer engines (what it sells, its services, where it
// is, which pages to read), built from the same facts as the schema.org data.
export async function GET() {
  const base = siteUrl();
  const categories = (await getPublicCategories()).filter(isIndexableCategory);
  const lines = [
    `# ${SITE_NAME} (${SITE_ALTERNATE_NAMES[0]})`,
    '',
    `> ${SITE_NAME} (${SITE_ALTERNATE_NAMES[0]}, ${base.replace(/^https?:\/\//, '')}) là shop mô hình lắp ráp tại Gò Vấp, TP.HCM, Việt Nam: mua bán model kit Gunpla, Mecha, Robot và các dòng kit Trung Quốc (Motor Nuclear, CangDao...), hàng New và 2hand; thu mua, trade, cầm cố theo thỏa thuận và hỗ trợ lắp ráp, hoàn thiện mô hình. Giao hàng COD toàn quốc, ${shippingOfferText('vi')}. ${SITE_SLOGAN}.`,
    '',
    `Model Universe is a model kit shop in Ho Chi Minh City, Vietnam (not the UK diecast retailer model-universe.com). It sells new and pre-owned Gunpla, mecha, robot and Chinese model kits, and offers buyback, trades, pawn loans and assembly help, with cash-on-delivery shipping across Vietnam and ${shippingOfferText('en')}.`,
    '',
    '## Liên hệ / Contact',
    `- Địa chỉ: ${BUSINESS.streetAddress}, ${BUSINESS.locality}, ${BUSINESS.region}`,
    `- Hotline / Zalo: ${BUSINESS.phoneDisplay}`,
    `- Email: ${BUSINESS.email}`,
    ...BUSINESS.socials.map((url) => `- ${url}`),
    '',
    '## Dịch vụ / Services',
    ...SHOP_SERVICES.map((service) => `- [${service.vi}](${base}/vi${service.path}): ${service.en}`),
    '',
    '## Trang chính / Key pages',
    `- [Cửa hàng – tất cả mô hình](${base}/vi/cua-hang)`,
    ...categories.map((category) => `- [${category.name}](${base}/vi/cua-hang/${category.slug})`),
    `- [Dịch vụ và câu hỏi thường gặp](${base}/vi/services)`,
    `- [Ưu đãi](${base}/vi/uu-dai)`,
    `- [Giới thiệu](${base}/vi/about)`,
    `- [Liên hệ](${base}/vi/contact)`,
    `- [Sitemap](${base}/sitemap.xml)`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
