import { isShopOpen } from '@/components/Contact/openingHours';
import { CONTACT, messengerWithText } from '@/shared/contact-channels';
import { BUSINESS } from '@/shared/seo';

describe('contact channels', () => {
  it('opens 08:00-22:00 in Ho Chi Minh City time, whatever the visitor clock', () => {
    // 01:00 UTC = 08:00 in Vietnam (UTC+7); 15:00 UTC = 22:00.
    expect(isShopOpen(new Date('2026-11-06T00:59:00Z'))).toBe(false);
    expect(isShopOpen(new Date('2026-11-06T01:00:00Z'))).toBe(true);
    expect(isShopOpen(new Date('2026-11-06T14:59:00Z'))).toBe(true);
    expect(isShopOpen(new Date('2026-11-06T15:00:00Z'))).toBe(false);
  });

  it('keeps the schema.org business facts identical to the channels shown to customers', () => {
    expect(BUSINESS.phone).toBe(CONTACT.phone);
    expect(BUSINESS.email).toBe(CONTACT.email);
    expect(CONTACT.tel).toBe(`tel:${CONTACT.phone}`);
    expect(CONTACT.zalo).toBe(`https://zalo.me/0${CONTACT.phone.slice(3)}`);
    expect(BUSINESS.socials).toEqual([CONTACT.facebook, CONTACT.tiktok, CONTACT.zalo]);
  });

  it('pre-fills Messenger with an encoded message', () => {
    expect(messengerWithText('Hỏi về: MG Sazabi & co')).toBe(
      `${CONTACT.messenger}?text=${encodeURIComponent('Hỏi về: MG Sazabi & co')}`,
    );
  });
});
