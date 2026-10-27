'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Api from '@/core/client/api/Api';

export interface UploadedEvidence {
  id: number;
  name: string;
  video: boolean;
  preview: string | null;
}

const MAX_FILES = 12;

// The customer's real photos (and a video for a buyback) as a compact tile grid: an add tile, a thumbnail per file with
// a remove button, and the count against the minimum of three photos.
export default function EvidenceUploader({
  purpose,
  files,
  onFiles,
  allowVideo = false,
  onBusy,
  minimumPhotos = 3,
  title,
  hint,
}: {
  minimumPhotos?: number;
  title?: string;
  hint?: string;
  purpose: 'buyback' | 'pawn';
  files: UploadedEvidence[];
  onFiles: (update: (files: UploadedEvidence[]) => UploadedEvidence[]) => void;
  allowVideo?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const t = useTranslations('itemCondition');
  const [progress, setProgress] = useState('');
  const photos = files.filter((file) => !file.video).length;
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target,
      chosen = Array.from(input.files || []).slice(0, MAX_FILES - files.length);
    onBusy?.(true);
    try {
      for (let index = 0; index < chosen.length; index++) {
        setProgress(t('uploading', { current: index + 1, total: chosen.length }));
        const form = new FormData();
        form.append('file', chosen[index]);
        form.append('purpose', purpose);
        const saved = (await Api.post('/evidence', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
        const video = chosen[index].type.startsWith('video/');
        onFiles((current) => [
          ...current,
          { id: saved.id, name: chosen[index].name, video, preview: video ? null : URL.createObjectURL(chosen[index]) },
        ]);
      }
    } catch {
      /* Successful uploads stay for a retry. */
    } finally {
      onBusy?.(false);
      setProgress('');
      input.value = '';
    }
  };
  return (
    <div className="evidence-uploader">
      <div className="evidence-head">
        <strong>{title || t('photos')}</strong>
        <span className={photos >= minimumPhotos ? 'is-ok' : ''}>
          {minimumPhotos === 3 ? t('photoCount', { count: photos }) : `${photos} / ${minimumPhotos}`}
        </span>
      </div>
      <p className="evidence-hint">{hint || t(allowVideo ? 'photosHintVideo' : 'photosHint')}</p>
      <ul className="evidence-grid">
        {files.map((file) => (
          <li key={file.id}>
            {file.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.preview} alt={file.name} />
            ) : (
              <span className="evidence-video">▶ {file.name}</span>
            )}
            <button
              type="button"
              aria-label={`${t('remove')} ${file.name}`}
              onClick={() => onFiles((current) => current.filter((item) => item.id !== file.id))}
            >
              ×
            </button>
          </li>
        ))}
        {files.length < MAX_FILES && (
          <li>
            <label className="evidence-add">
              <input
                type="file"
                multiple
                accept={`image/jpeg,image/png,image/webp${allowVideo ? ',video/mp4,video/webm,video/quicktime' : ''}`}
                disabled={!!progress}
                onChange={(event) => void upload(event)}
              />
              <span aria-hidden="true">+</span>
              <small>{progress || t('add')}</small>
            </label>
          </li>
        )}
      </ul>
    </div>
  );
}
