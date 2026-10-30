'use client';

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from 'react';
import TextField, { inputClassName } from '@/components/FormElements/TextField';
import ReviewApi, { ReviewMediaItem } from '@/core/client/api/Review';
import { toast } from 'react-toastify';

const RATING_LABELS = [
  'Rất không hài lòng',
  'Không hài lòng',
  'Bình thường',
  'Hài lòng',
  'Rất hài lòng / Tuyệt vời',
];

const QUICK_TAGS = [
  'Chất lượng tuyệt vời',
  'Đóng gói rất cẩn thận',
  'Mô hình sắc nét chính hãng',
  'Giao hàng siêu nhanh',
  'Phục vụ chu đáo',
  'Đúng như mô tả',
  'Rất đáng tiền',
];

const MAX_FILES = 6;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ReviewForm = ({ productId, onSubmitted }: { productId: number; onSubmitted: () => void }) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Chất lượng tuyệt vời', 'Đóng gói rất cẩn thận']);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaList, setMediaList] = useState<ReviewMediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [titleError, setTitleError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  };

  const handleFiles = async (files: FileList | File[]) => {
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" vượt quá giới hạn 50MB.`);
        continue;
      }
      if (
        !file.type.startsWith('image/') &&
        !file.type.startsWith('video/') &&
        !file.name.match(/\.(jpg|jpeg|png|webp|mp4|webm|mov)$/i)
      ) {
        toast.error(`File "${file.name}" không phải định dạng ảnh hoặc video hợp lệ.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    if (mediaList.length + validFiles.length > MAX_FILES) {
      toast.warn(`Bạn chỉ có thể đính kèm tối đa ${MAX_FILES} hình ảnh hoặc video.`);
    }

    const availableSlots = Math.max(0, MAX_FILES - mediaList.length);
    const filesToUpload = validFiles.slice(0, availableSlots);
    if (filesToUpload.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await ReviewApi.uploadMedia(filesToUpload);
      if (uploaded && uploaded.length > 0) {
        setMediaList((current) => [...current, ...uploaded]);
        toast.success(`Đã tải lên thành công ${uploaded.length} tệp phương tiện.`);
      }
    } catch {
      toast.error('Tải lên phương tiện thất bại. Vui lòng thử lại.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      void handleFiles(event.target.files);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      void handleFiles(event.dataTransfer.files);
    }
  };

  const removeMedia = (index: number) => {
    setMediaList((current) => current.filter((_, idx) => idx !== index));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError('Vui lòng nhập tiêu đề đánh giá.');
      return;
    }
    setTitleError(undefined);
    setSubmitting(true);
    const hasMedia = mediaList.length > 0;
    const created = await ReviewApi.createReview({
      productId,
      rating,
      title: title.trim(),
      content: content.trim(),
      tags: selectedTags,
      media: mediaList,
    });
    setSubmitting(false);
    if (created) {
      const earned = hasMedia ? 40 : 15;
      toast.success(`Đánh giá của bạn đã được đăng! Bạn nhận được +${earned} điểm tích lũy.`);
      onSubmitted();
    } else {
      toast.error('Không thể đăng đánh giá. Vui lòng kiểm tra lại thông tin.');
    }
  };

  const effectiveRating = hoverRating || rating;
  const hasPhotosOrVideos = mediaList.length > 0;

  return (
    <form
      id="reviews"
      onSubmit={submit}
      className="mb-8 flex scroll-mt-24 flex-col gap-5 rounded-xl border border-stroke bg-white p-6 shadow-sm transition-all dark:border-store-card dark:bg-store-surface"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Viết đánh giá trải nghiệm của bạn</h3>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400">
            {hasPhotosOrVideos ? '🎁 Nhận +40 điểm ví thành viên' : '🎁 Nhận +15 điểm ví (kèm ảnh/video: +40đ)'}
          </span>
        </div>
        <p className="text-xs text-body dark:text-store-muted">
          Chia sẻ đánh giá chân thực để nhận điểm thưởng tích lũy Model Universe và giúp cộng đồng người sưu tầm có cái nhìn trực quan.
        </p>
      </div>

      {/* Star rating with hover effect */}
      <div className="flex flex-col gap-2 rounded-lg bg-gray-50/80 p-4 dark:bg-store-card/40">
        <label className="text-xs font-semibold uppercase tracking-wider text-body dark:text-store-muted">
          Đánh giá chất lượng chung
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                aria-label={`${star} sao`}
                className="group relative p-1 transition-transform hover:scale-125 focus:outline-none"
              >
                <svg
                  className={`h-8 w-8 transition-colors ${
                    star <= effectiveRating
                      ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                      : 'fill-gray-200 text-gray-300 dark:fill-gray-700 dark:text-gray-600'
                  }`}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </button>
            ))}
          </div>
          <span className="rounded-md bg-white px-2.5 py-1 text-sm font-semibold text-amber-600 shadow-sm ring-1 ring-inset ring-amber-200 dark:bg-store-card dark:text-amber-400 dark:ring-amber-800">
            {RATING_LABELS[effectiveRating - 1]}
          </span>
        </div>
      </div>

      {/* Google Maps style quick feedback tags */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-body dark:text-store-muted">
          Điểm nổi bật của sản phẩm & dịch vụ (nhấp chọn nhanh)
        </label>
        <div className="flex flex-wrap gap-2">
          {QUICK_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-brand text-brand-ink shadow-sm ring-2 ring-brand-hover/40'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-store-card dark:text-store-muted dark:hover:bg-store-card/80'
                }`}
              >
                {isSelected && (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Media Uploader (Images & Videos) - Google Maps Style */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-body dark:text-store-muted">
            Hình ảnh & Video thực tế ({mediaList.length}/{MAX_FILES})
          </label>
          <span className="text-xs text-brand font-medium">
            +25 điểm thưởng khi có ít nhất 1 ảnh/video
          </span>
        </div>

        {/* Upload previews & drop zone */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {mediaList.map((item, index) => (
            <div
              key={index}
              className="group relative aspect-square overflow-hidden rounded-lg border border-stroke bg-gray-100 dark:border-store-card dark:bg-store-card"
            >
              {item.type === 'video' ? (
                <div className="relative h-full w-full">
                  <video src={item.url} className="h-full w-full object-cover" preload="metadata" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black shadow">
                      <svg className="h-4 w-4 fill-current ml-0.5" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-semibold text-white">
                    VIDEO
                  </span>
                </div>
              ) : (
                <img src={item.url} alt={item.name || 'Ảnh đánh giá'} className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow-md transition-all hover:bg-red-600 focus:outline-none"
                aria-label="Xóa tệp này"
              >
                ×
              </button>
            </div>
          ))}

          {mediaList.length < MAX_FILES && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-2 text-center transition-all ${
                isDragging
                  ? 'border-brand bg-brand/10'
                  : 'border-stroke bg-gray-50/60 hover:border-brand hover:bg-gray-100 dark:border-store-card dark:bg-store-card/40 dark:hover:bg-store-card/80'
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  <span className="text-[11px] text-body dark:text-store-muted">Đang tải...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-500 dark:text-gray-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                    />
                  </svg>
                  <span className="text-[11px] font-medium leading-tight">Thêm ảnh / video</span>
                </div>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={onFileInputChange}
        />
        <p className="text-[11px] text-body dark:text-store-muted">
          Hỗ trợ ảnh JPG, PNG, WEBP và video MP4, WEBM (tối đa 50MB/tệp).
        </p>
      </div>

      <TextField
        label="Tiêu đề đánh giá"
        name="reviewTitle"
        placeholder="Tóm tắt ngắn gọn trải nghiệm của bạn (ví dụ: Mô hình rất đẹp, đóng gói kỹ lưỡng)"
        maxLength={120}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={titleError}
      />

      <div>
        <label htmlFor="reviewContent" className="mb-2 block text-sm font-medium text-black dark:text-white">
          Chia sẻ chi tiết đánh giá (không bắt buộc)
        </label>
        <textarea
          id="reviewContent"
          rows={4}
          maxLength={2000}
          placeholder="Bạn cảm thấy thế nào về độ chi tiết mô hình, chất lượng khớp, phụ kiện, thời gian giao hàng và sự hỗ trợ của shop?"
          className={inputClassName}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-stroke dark:border-store-card">
        <div className="text-xs text-body dark:text-store-muted">
          Điểm thưởng sẽ được tự động cộng vào tài khoản ví của bạn ngay sau khi gửi.
        </div>
        <button
          type="submit"
          disabled={submitting || uploading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-7 py-3 font-semibold text-brand-ink shadow-sm transition-all hover:bg-brand-hover hover:shadow disabled:opacity-60"
        >
          {submitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Đang gửi đánh giá...</span>
            </>
          ) : (
            <>
              <span>Gửi đánh giá</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default ReviewForm;
