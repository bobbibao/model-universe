import Image from 'next/image';
import Link from '@/i18n/navigation';
import './brand-logo.css';

export const BRAND_NAME = 'Model Universe';

interface BrandLogoProps {
  href?: string;
  className?: string;
  showName?: boolean;
}

// The colour ram-head mark and the "MODEL UNIVERSE" wordmark (public/brand, built by
// assets/brand/build_brand_assets.py). The wordmark is an alpha mask painted in currentColor, so each place sets its
// colour (dark on light, white on dark) and both sizes with plain CSS.
const BrandLogo = ({ href = '/', className = '', showName = true }: BrandLogoProps) => {
  return (
    <Link href={href} aria-label={BRAND_NAME} className={`brand-logo ${className}`}>
      <Image className="brand-logo-mark" src="/brand/mark.webp" alt="" width={245} height={256} unoptimized priority />
      {showName && <span className="brand-logo-word" aria-hidden="true" />}
    </Link>
  );
};

export default BrandLogo;
