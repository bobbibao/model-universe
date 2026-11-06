// The shop's contact channels, one source for the contact page, the footer, the floating contact button, product
// pages and the schema.org business facts (src/shared/seo.ts). Change a number or address here only.

const PHONE_DIGITS = '0373725104';

export const CONTACT = {
  phone: '+84373725104',
  phoneDisplay: '0373 725 104',
  tel: `tel:+84${PHONE_DIGITS.slice(1)}`,
  zalo: `https://zalo.me/${PHONE_DIGITS}`,
  facebook: 'https://www.facebook.com/modeluniverse.vn',
  messenger: 'https://m.me/modeluniverse.vn',
  tiktok: 'https://www.tiktok.com/@model.universe.c',
  tiktokHandle: '@model.universe.c',
  email: 'contact@modeluniverse.vn',
  supportEmail: 'support@modeluniverse.vn',
  streetAddress: '730/126 Lê Đức Thọ',
  locality: 'An Hội Đông, Gò Vấp',
  region: 'Thành phố Hồ Chí Minh',
  addressLine: '730/126 Lê Đức Thọ, An Hội Đông (Gò Vấp), TP. Hồ Chí Minh',
  mapsUrl: 'https://maps.google.com/?q=730/126+Le+Duc+Tho+An+Hoi+Dong+Go+Vap+Ho+Chi+Minh',
  hours: '08:00 – 22:00',
} as const;

// Messenger opens the conversation with this text typed in (m.me supports ?text=); Zalo links cannot carry text.
export const messengerWithText = (text: string) => `${CONTACT.messenger}?text=${encodeURIComponent(text)}`;
