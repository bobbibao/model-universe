import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Model Universe – Vũ Trụ Mô Hình',
    short_name: 'Model Universe',
    description:
      'Mua bán mô hình lắp ráp Gunpla, Mecha, Robot, kit Trung Quốc New & 2hand. Thu mua, trade, cầm cố, hỗ trợ lắp ráp. Gò Vấp, TP.HCM, COD toàn quốc.',
    start_url: '/vi',
    display: 'standalone',
    background_color: '#0a0d14',
    theme_color: '#3b82f6',
    lang: 'vi',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
