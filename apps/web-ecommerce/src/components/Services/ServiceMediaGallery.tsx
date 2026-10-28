'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import AdminIcon from '@/components/Admin/AdminIcon';

export interface ServiceEvidenceFile {
  id: number;
  originalName: string;
  mimeType?: string;
  purpose?: string;
}

export interface ServiceMediaGalleryProps {
  files: ServiceEvidenceFile[];
  title: string;
  subtitle?: string;
  badge?: string;
  emptyMessage?: string;
  className?: string;
  accentColor?: 'brand' | 'emerald' | 'amber' | 'purple' | 'cyan';
}

export default function ServiceMediaGallery({
  files = [],
  title,
  subtitle,
  badge,
  emptyMessage = 'Chưa có ảnh hoặc video nào được tải lên.',
  className = '',
  accentColor = 'brand',
}: ServiceMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const isVideo = (file: ServiceEvidenceFile) => {
    return (
      file.mimeType?.startsWith('video/') ||
      /\.(mp4|webm|mov|mkv)$/i.test(file.originalName)
    );
  };

  const handleNext = useCallback(() => {
    if (activeIndex === null || files.length === 0) return;
    setActiveIndex((prev) => ((prev ?? 0) + 1) % files.length);
  }, [activeIndex, files.length]);

  const handlePrev = useCallback(() => {
    if (activeIndex === null || files.length === 0) return;
    setActiveIndex((prev) => ((prev ?? 0) - 1 + files.length) % files.length);
  }, [activeIndex, files.length]);

  const handleClose = useCallback(() => {
    setActiveIndex(null);
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, handleClose, handleNext, handlePrev]);

  const activeFile = activeIndex !== null ? files[activeIndex] : null;

  return (
    <div className={`service-media-gallery rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-strokedark dark:bg-boxdark ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-strokedark">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-meta-4 dark:text-slate-200">
            <AdminIcon name="box" size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
              {badge && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-meta-4 dark:text-slate-300">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
        </div>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {files.length > 0 ? (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 dark:bg-meta-4">
              {files.length} tệp
            </span>
          ) : (
            <span className="text-slate-400">0 tệp</span>
          )}
        </div>
      </div>

      {/* Gallery Content */}
      <div className="pt-3">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-7 text-center dark:border-strokedark">
            <div className="mb-2 text-slate-400">
              <AdminIcon name="box" size={24} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
            {files.map((file, idx) => {
              const video = isVideo(file);
              const hasError = imageErrors[file.id];

              return (
                <div
                  key={file.id}
                  onClick={() => setActiveIndex(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveIndex(idx);
                    }
                  }}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50 transition-all duration-200 hover:border-purple-500/70 hover:shadow-md focus:ring-2 focus:ring-purple-600 focus:outline-none dark:border-strokedark dark:bg-meta-4/20"
                >
                  {video ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 p-2 text-center text-white">
                      <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-transform group-hover:scale-110">
                        <span className="text-base font-bold">▶</span>
                      </div>
                      <span className="line-clamp-2 px-1 text-[11px] font-medium text-slate-200">
                        {file.originalName}
                      </span>
                      <span className="mt-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-300">
                        Video
                      </span>
                    </div>
                  ) : hasError ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 p-2 text-center text-slate-400 dark:bg-meta-4/40">
                      <AdminIcon name="close" size={20} />
                      <span className="mt-1 line-clamp-1 text-[10px]">{file.originalName}</span>
                    </div>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/evidence/${file.id}`}
                        alt={file.originalName}
                        loading="lazy"
                        onError={() =>
                          setImageErrors((prev) => ({ ...prev, [file.id]: true }))
                        }
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-md backdrop-blur-xs">
                          <AdminIcon name="search" size={13} />
                          Xem lớn
                        </span>
                      </div>
                    </>
                  )}

                  {/* Top Index & Tag */}
                  <div className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs">
                    #{idx + 1}
                  </div>

                  {/* Bottom Filename */}
                  <div className="absolute right-0 bottom-0 left-0 truncate bg-black/55 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur-xs">
                    {file.originalName}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal via Portal */}
      {mounted &&
        activeFile &&
        createPortal(
          <div
            className="fixed inset-0 flex flex-col justify-between p-4 text-white animate-fadeIn"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.96)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              zIndex: 999999,
            }}
            role="dialog"
            aria-modal="true"
            aria-label={activeFile.originalName}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            {/* Top Toolbar */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white shadow-xs">
                  {activeIndex! + 1} / {files.length}
                </span>
                <span className="truncate max-w-[200px] sm:max-w-md text-sm font-bold text-white">
                  {activeFile.originalName}
                </span>
                {badge && (
                  <span className="hidden sm:inline-block rounded-md bg-purple-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/evidence/${activeFile.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25 shadow-xs"
                >
                  Mở tab mới ↗
                </a>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Đóng (Escape)"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white font-bold transition-colors hover:bg-white/35 shadow-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Central Media Viewer */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden py-4">
              {/* Prev Button */}
              {files.length > 1 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Ảnh trước (Mũi tên trái)"
                  className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-2xl font-bold text-white shadow-xl border border-white/20 backdrop-blur-xs transition-all hover:scale-110 hover:bg-black sm:left-6"
                >
                  ‹
                </button>
              )}

              {/* Main Media Content Canvas */}
              <div className="flex max-h-[75vh] max-w-[88vw] items-center justify-center rounded-2xl bg-slate-900/80 p-2 border border-white/10 shadow-2xl overflow-hidden">
                {isVideo(activeFile) ? (
                  <video
                    src={`/api/evidence/${activeFile.id}`}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[72vh] max-w-[85vw] rounded-xl shadow-2xl"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/evidence/${activeFile.id}`}
                    alt={activeFile.originalName}
                    className="max-h-[72vh] max-w-[85vw] min-w-[260px] min-h-[200px] rounded-xl object-contain shadow-2xl transition-all select-none"
                  />
                )}
              </div>

              {/* Next Button */}
              {files.length > 1 && (
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Ảnh tiếp theo (Mũi tên phải)"
                  className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-2xl font-bold text-white shadow-xl border border-white/20 backdrop-blur-xs transition-all hover:scale-110 hover:bg-black sm:right-6"
                >
                  ›
                </button>
              )}
            </div>

            {/* Bottom Filmstrip Thumbnails */}
            {files.length > 1 && (
              <div className="flex shrink-0 items-center justify-center overflow-x-auto border-t border-white/15 pt-3">
                <div className="flex gap-2 pb-1">
                  {files.map((file, idx) => {
                    const isSelected = idx === activeIndex;
                    const video = isVideo(file);

                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'scale-110 border-white ring-2 ring-purple-500 shadow-lg'
                            : 'border-white/20 opacity-60 hover:opacity-100 hover:scale-105'
                        }`}
                      >
                        {video ? (
                          <div className="flex h-full w-full items-center justify-center bg-slate-800 text-xs font-bold text-white">
                            ▶
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/evidence/${file.id}`}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

