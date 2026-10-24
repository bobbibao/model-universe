'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import ProductImage from '@/components/ProductImage';
import ProductStage from '@/components/ProductStage';
import AdminIcon from '@/components/Admin/AdminIcon';
import Modal from '@/components/Modal/Modal';

const ProductGallery = ({ images, alt }: { images: string[]; alt: string }) => {
  const t = useTranslations('catalog');
  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const ux = useTranslations('commerceUX');
  const experience = useTranslations('experience');
  const photos = [...new Set(images.filter(Boolean))];
  if (!photos.length) photos.push('');

  const imageKey = photos.join('|');
  useEffect(() => setCurrent(0), [imageKey]);
  const photoCount = photos.length;
  useEffect(() => {
    if (!zoomed) return;
    const handleArrow = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      setCurrent((value) => (value + (event.key === 'ArrowLeft' ? -1 : 1) + photoCount) % photoCount);
    };
    document.addEventListener('keydown', handleArrow);
    return () => document.removeEventListener('keydown', handleArrow);
  }, [zoomed, photoCount]);
  const index = Math.min(current, photos.length - 1);
  const move = (step: number) => setCurrent((value) => (value + step + photos.length) % photos.length);

  return (
    <div className="studio-gallery flex flex-col gap-4">
      <div className="studio-gallery-toolbar">
        <span>
          <AdminIcon name="box" size={16} />
          {experience('actualPhotos')}
        </span>
      </div>
      <button
        type="button"
        className="product-gallery-expand"
        aria-label={ux('enlargePhoto')}
        onClick={() => setZoomed(true)}
      >
        <ProductStage
          src={photos[index]}
          alt={alt}
          className="studio-detail-stage"
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
        <span className="product-gallery-expand-label">
          <AdminIcon name="search" size={16} />
          {ux('enlargePhoto')}
        </span>
      </button>
      <div className="studio-gallery-controls">
        <span aria-live="polite">{experience('photoPosition', { current: index + 1, count: photos.length })}</span>
        {photos.length > 1 && (
          <div>
            <button type="button" aria-label={experience('previousPhoto')} onClick={() => move(-1)}>
              ←
            </button>
            <button type="button" aria-label={experience('nextPhoto')} onClick={() => move(1)}>
              →
            </button>
          </div>
        )}
      </div>
      {photos.length > 1 && (
        <div className="product-gallery-thumbnails">
          {photos.map((image, index) => (
            <button
              key={`${image}-${index}`}
              onClick={() => setCurrent(index)}
              aria-label={t('photo', { number: index + 1 })}
              aria-pressed={index === current}
              className={`relative aspect-square overflow-hidden rounded border-2 bg-gray-2 dark:bg-store-card ${
                index === current ? 'border-brand-hover' : 'border-transparent'
              }`}
            >
              <ProductImage src={image} alt="" sizes="120px" />
            </button>
          ))}
        </div>
      )}
      <Modal open={zoomed} onClose={() => setZoomed(false)} title={ux('enlargePhoto')} size="lg">
        <div className="product-gallery-lightbox">
          <div className="product-gallery-full">
            <ProductImage src={photos[index]} alt={`${alt} · ${index + 1}`} sizes="(min-width: 768px) 720px, 100vw" />
          </div>
          <div className="product-gallery-lightbox-nav">
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={photos.length < 2}
              aria-label={experience('previousPhoto')}
            >
              ←
            </button>
            <span aria-live="polite">{experience('photoPosition', { current: index + 1, count: photos.length })}</span>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={photos.length < 2}
              aria-label={experience('nextPhoto')}
            >
              →
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductGallery;
