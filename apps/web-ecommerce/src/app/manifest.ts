import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Model Universe — Hệ Thống Mô Hình 2hand, Gunpla & Figure Chính Hãng',
    short_name: 'Model Universe',
    description:
      'Chuyên mô hình Gundam, Metal Build, Figure hợp kim chính hãng 2hand độ mới 95-98%. Kiểm định nghiêm ngặt, bảo hành an tâm.',
    start_url: '/vi',
    display: 'standalone',
    background_color: '#0a0d14',
    theme_color: '#3b82f6',
    lang: 'vi',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
    ],
  };
}
