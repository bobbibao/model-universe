'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';

export const PRODUCT_IMAGE_PLACEHOLDER = '/images/store/product-placeholder.svg';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

// Automatically choose responsive format for remote CDNs (e.g. Shopee _tn.webp for thumbnails).
function getOptimizedUrl(url?: string | null): string {
  if (!url) return PRODUCT_IMAGE_PLACEHOLDER;
  // Shopee CDN: append _tn.webp to return ~25KB WebP thumbnail instead of 500KB+ raw JPEG
  if (url.includes('susercontent.com/file/') && !url.includes('_tn')) {
    return `${url}_tn.webp`;
  }
  return url;
}

// Fills its (relatively positioned) parent. Images are served unoptimized by Next.js because uploads
// are served directly by Express static middleware and external CDNs are served directly without server overhead.
const ProductImage = ({ src, alt, className = 'object-cover', sizes, priority }: ProductImageProps) => {
  const initialUrl = getOptimizedUrl(src);
  const [currentSrc, setCurrentSrc] = useState(initialUrl);

  useEffect(() => {
    setCurrentSrc(getOptimizedUrl(src));
  }, [src]);

  const handleError = () => {
    // If the optimized CDN url failed, try original src before falling back to placeholder
    if (src && currentSrc !== src && currentSrc !== PRODUCT_IMAGE_PLACEHOLDER) {
      setCurrentSrc(src);
    } else {
      setCurrentSrc(PRODUCT_IMAGE_PLACEHOLDER);
    }
  };

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill
      unoptimized
      sizes={sizes || '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'}
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      className={className}
      onError={handleError}
    />
  );
};

export default ProductImage;
