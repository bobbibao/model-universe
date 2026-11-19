import Link from '@/i18n/navigation';
import './brand-logo.css';

export const BRAND_NAME = 'Model Universe';

interface BrandLogoProps {
  href?: string;
  className?: string;
  showName?: boolean;
}

// The line-art ram-head mark (an alpha mask built by assets/brand/build_brand_assets.py) and the name as live text in
// Satoshi. Both take currentColor, so each place sets one colour (navy on light, white on dark) and the sizes with
// --brand-mark and --brand-word.
const BrandLogo = ({ href = '/', className = '', showName = true }: BrandLogoProps) => {
  return (
    <Link href={href} aria-label={BRAND_NAME} className={`brand-logo ${className}`}>
      <span className="brand-logo-mark" aria-hidden="true" />
      {showName && (
        <span className="brand-logo-word" aria-hidden="true">
          {BRAND_NAME}
        </span>
      )}
    </Link>
  );
};

export default BrandLogo;
