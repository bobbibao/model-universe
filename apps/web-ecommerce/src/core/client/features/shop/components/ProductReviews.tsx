'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useCustomerActionRefresh from '@/hooks/useCustomerActionRefresh';
import ProductApi from '@/core/client/api/Product';
import ReviewApi from '@/core/client/api/Review';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import UserAvatar from '@/components/UserAvatar';
import type { Pagination } from '@/shared/types/pagination';
import type { RatingDistribution, Review, ReviewMediaItem } from '@/shared/types/product';
import RatingStars from './RatingStars';
import ReviewForm from './ReviewForm';

const REVIEWS_PER_PAGE = 5;

interface ProductReviewsProps {
  productId: number;
  rating: number;
  reviewCount: number;
  distribution: RatingDistribution;
  onReviewSubmitted: () => void;
}

const ProductReviews = ({ productId, rating, reviewCount, distribution, onReviewSubmitted }: ProductReviewsProps) => {
  const t = useTranslations('catalog');
  const common = useTranslations('common');
  const locale = useLocale();
  const { user } = useCurrentUser();
  const [canReview, setCanReview] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState<Pagination>();
  const [loading, setLoading] = useState(false);
  const [activeMedia, setActiveMedia] = useState<ReviewMediaItem | null>(null);

  const loadPage = useCallback(
    async (page: number) => {
      setLoading(true);
      const result = await ProductApi.getReviews(productId, page, REVIEWS_PER_PAGE);
      if (result) {
        setReviews((current) => (page === 1 ? result.data : [...current, ...result.data]));
        setPagination(result.pagination);
      }
      setLoading(false);
    },
    [productId],
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  // Only customers with a delivered order of this product who have not reviewed it yet see the form.
  useEffect(() => {
    if (!user) {
      setCanReview(false);
      return;
    }
    ReviewApi.getEligibility(productId).then((result) => setCanReview(!!result?.canReview));
  }, [user, productId]);

  const handleSubmitted = () => {
    setCanReview(false);
    loadPage(1);
    onReviewSubmitted();
  };
  useCustomerActionRefresh('review', handleSubmitted);

  return (
    <section className="mt-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reviews')}</h2>
          <p className="text-sm text-body dark:text-store-muted">
            Đánh giá từ khách hàng đã mua và nhận sản phẩm tại Model Universe
          </p>
        </div>
      </div>

      {canReview && <ReviewForm productId={productId} onSubmitted={handleSubmitted} />}

      {reviewCount === 0 ? (
        <div className="rounded-xl border border-dashed border-stroke p-8 text-center dark:border-store-card">
          <p className="text-body dark:text-store-muted">{t('noProductReviews')}</p>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-3">
          <div>
            <div className="mb-6 rounded-xl border border-stroke bg-gray-50/50 p-6 dark:border-store-card dark:bg-store-card/30">
              <div className="mb-4 flex items-center gap-4">
                <span className="text-5xl font-extrabold text-gray-900 dark:text-white">{rating.toFixed(1)}</span>
                <div>
                  <RatingStars rating={rating} />
                  <p className="mt-1 text-sm text-body dark:text-store-muted">{t('reviewCount', { count: reviewCount })}</p>
                </div>
              </div>
              {(['5', '4', '3', '2', '1'] as const).map((star) => {
                const percent = reviewCount > 0 ? Math.round((distribution[star] / reviewCount) * 100) : 0;
                return (
                  <div key={star} className="mb-2 flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 font-medium">{t('stars', { count: Number(star) })}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stroke dark:bg-store-card">
                      <div className="h-full rounded-full bg-brand-hover transition-all duration-300" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-semibold text-body dark:text-store-muted">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-2">
            {reviews.map((review) => {
              const hasTags = review.tags && Array.isArray(review.tags) && review.tags.length > 0;
              const hasMedia = review.media && Array.isArray(review.media) && review.media.length > 0;

              return (
                <article
                  key={review.id}
                  className="rounded-xl border border-stroke bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-store-card dark:bg-store-surface"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        user={{ firstName: review.author, lastName: '', avatar: review.authorAvatar }}
                        size={40}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white">{review.author}</span>
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400">
                            ✓ Đã mua hàng
                          </span>
                        </div>
                        <p className="text-xs text-body dark:text-store-muted">
                          {review.location ? `${review.location} · ` : ''}
                          {new Date(review.createdAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-GB')}
                        </p>
                      </div>
                    </div>
                    <RatingStars rating={review.rating} size="sm" />
                  </div>

                  <h4 className="mb-1 text-base font-bold text-gray-900 dark:text-white">{review.title}</h4>

                  {/* Google Maps style tags / chips */}
                  {hasTags && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {review.tags?.map((tag, tagIdx) => (
                        <span
                          key={tagIdx}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-store-card dark:text-store-muted"
                        >
                          <span className="text-brand font-bold">#</span>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {review.content && (
                    <p className="mb-3 text-sm leading-relaxed text-gray-700 whitespace-pre-line dark:text-gray-300">
                      {review.content}
                    </p>
                  )}

                  {/* Media gallery with photo zoom / video player */}
                  {hasMedia && (
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {review.media?.map((item, mediaIdx) => (
                        <button
                          key={mediaIdx}
                          type="button"
                          onClick={() => setActiveMedia(item)}
                          className="group relative h-20 w-20 overflow-hidden rounded-lg border border-stroke bg-gray-100 transition-all hover:ring-2 hover:ring-brand focus:outline-none dark:border-store-card dark:bg-store-card sm:h-24 sm:w-24"
                        >
                          {item.type === 'video' ? (
                            <div className="relative h-full w-full">
                              <video src={item.url} className="h-full w-full object-cover" preload="metadata" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-black shadow">
                                  <svg className="h-3.5 w-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={item.url}
                              alt={item.name || 'Ảnh đánh giá'}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}

            {pagination?.hasNextPage && (
              <button
                onClick={() => loadPage(pagination.page + 1)}
                disabled={loading}
                className="self-start rounded-lg bg-gray px-6 py-2.5 font-medium text-black hover:opacity-90 disabled:opacity-60 dark:bg-store-card dark:text-store-text"
              >
                {loading ? common('loading') : t('more')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Media Lightbox / Modal */}
      {activeMedia && (
        <div
          className="fixed inset-0 z-99999 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setActiveMedia(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveMedia(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur hover:bg-black/90 focus:outline-none"
              aria-label="Đóng xem trước"
            >
              ✕
            </button>
            {activeMedia.type === 'video' ? (
              <video
                src={activeMedia.url}
                controls
                autoPlay
                className="max-h-[85vh] max-w-[85vw] rounded-xl"
              />
            ) : (
              <img
                src={activeMedia.url}
                alt={activeMedia.name || 'Ảnh chi tiết'}
                className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl"
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default ProductReviews;
