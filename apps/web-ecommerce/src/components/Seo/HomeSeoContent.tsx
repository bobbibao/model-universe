import Link from '@/i18n/navigation';
import { BUSINESS, isEnglish, shippingOfferText } from '@/shared/seo';

// The shop in plain words at the bottom of the home page: what it sells, its services, where it is. Search engines
// and AI answer engines quote this text; the FAQ is also the home page's FAQPage data, so both always match.
export function homeFaq(locale: string) {
  const address = `${BUSINESS.streetAddress}, ${BUSINESS.locality}, ${BUSINESS.region}`;
  return isEnglish(locale)
    ? [
        {
          question: 'What does Model Universe (Vũ Trụ Mô Hình) sell?',
          answer:
            'Model kits: Gunpla, mecha and robot kits and Chinese model kits such as Motor Nuclear and CangDao, both new and pre-owned. Every pre-owned listing states its condition: box, accessories and whether it is built.',
        },
        {
          question: 'Does Model Universe buy or trade model kits?',
          answer:
            'Yes. We buy model kits, trade them and help you sell off a collection. Send photos through the buyback form or Zalo to get a quote.',
        },
        {
          question: 'Can I pawn a model kit at Model Universe?',
          answer: 'Yes, pawn loans on model kits are available by agreement, with a written contract. See the pawn service page.',
        },
        {
          question: 'Do you help with building model kits?',
          answer: 'Yes, we help with assembly and finishing. Message us on Zalo or call the hotline with the kit for a quote.',
        },
        {
          question: 'Where is the shop and how do you ship?',
          answer: `The shop is at ${address} (Go Vap). You can see a kit in person by appointment; orders are packed carefully and shipped cash on delivery across Vietnam, with ${shippingOfferText(locale)}.`,
        },
      ]
    : [
        {
          question: 'Model Universe (Vũ Trụ Mô Hình) bán những loại mô hình nào?',
          answer:
            'Mô hình lắp ráp (model kit): Gunpla, Mecha, Robot và các dòng kit Trung Quốc như Motor Nuclear, CangDao, có cả hàng New và 2hand. Mỗi sản phẩm 2hand đều ghi rõ tình trạng: hộp, phụ kiện, đã ráp hay chưa ráp.',
        },
        {
          question: 'Shop có thu mua và trade mô hình không?',
          answer:
            'Có. Model Universe thu mua mô hình, nhận trade (trao đổi) và hỗ trợ thanh lý bộ sưu tập. Gửi ảnh qua form thu mua hoặc Zalo để được báo giá.',
        },
        {
          question: 'Có nhận cầm cố mô hình không?',
          answer: 'Có, shop nhận cầm cố mô hình theo thỏa thuận, hợp đồng rõ ràng. Xem chi tiết tại trang dịch vụ cầm cố.',
        },
        {
          question: 'Shop có hỗ trợ lắp ráp mô hình không?',
          answer: 'Có, shop hỗ trợ lắp ráp và hoàn thiện mô hình. Nhắn Zalo hoặc gọi hotline kèm tên kit để được báo giá.',
        },
        {
          question: 'Shop mô hình ở đâu, giao hàng thế nào?',
          answer: `Shop ở ${address} (Gò Vấp). Bạn có thể hẹn xem hàng trực tiếp; đơn hàng được đóng gói kỹ, giao COD toàn quốc và ${shippingOfferText(locale)}.`,
        },
      ];
}

export default function HomeSeoContent({ locale }: { locale: string }) {
  const en = isEnglish(locale);
  const links: [string, string][] = en
    ? [
        ['/cua-hang', 'Shop all model kits'],
        ['/services/sell', 'Sell your kits'],
        ['/services/trade', 'Trade'],
        ['/services/pawn', 'Pawn loans'],
        ['/contact', 'Contact and directions'],
      ]
    : [
        ['/cua-hang', 'Xem tất cả mô hình'],
        ['/services/sell', 'Thu mua mô hình'],
        ['/services/trade', 'Trade mô hình'],
        ['/services/pawn', 'Cầm cố mô hình'],
        ['/contact', 'Liên hệ & chỉ đường'],
      ];
  return (
    <section className="mu-wrap mu-section home-about" aria-labelledby="home-about-title">
      <div className="home-about-intro">
        <p className="studio-kicker">{en ? 'About the shop' : 'Về Vũ Trụ Mô Hình'}</p>
        <h2 id="home-about-title" className="mu-heading">
          {en ? 'Model Universe – the model kit shop in Go Vap, Ho Chi Minh City' : 'Model Universe – shop mô hình lắp ráp tại Gò Vấp, TP.HCM'}
        </h2>
        <p>
          {en
            ? 'Model Universe (Vũ Trụ Mô Hình) buys and sells model kits: Gunpla, mecha and robot kits and Chinese kits, new and pre-owned. We also buy, trade and take kits in pawn, help with assembly and finishing, and advise you on a kit for your budget.'
            : 'Model Universe (Vũ Trụ Mô Hình) chuyên mua bán mô hình lắp ráp (model kit): Gunpla, Mecha, Robot và các dòng kit Trung Quốc, hàng New và 2hand. Shop nhận thu mua, trade, cầm cố mô hình theo thỏa thuận, hỗ trợ lắp ráp, hoàn thiện và tư vấn chọn mô hình theo nhu cầu, ngân sách.'}
        </p>
        <p>{en ? 'Connect your passion – grow your collection.' : 'Kết nối đam mê – Mở rộng bộ sưu tập.'}</p>
        <nav className="home-about-links" aria-label={en ? 'Shop and services' : 'Cửa hàng và dịch vụ'}>
          {links.map(([href, label]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="home-about-faq">
        <h2>{en ? 'Frequently asked questions' : 'Câu hỏi thường gặp'}</h2>
        {homeFaq(locale).map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
