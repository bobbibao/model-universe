import { PUBLIC_UPLOAD_PREFIX } from '../FileStorageService';

// A unit in a one-of-a-kind condition (e.g. second hand): one piece, at least three distinct uploaded photos.
export const uniquePhotosMissing = (stock: number, imageUrl: string, images: string[]) =>
  stock > 1 ||
  !imageUrl.startsWith(`${PUBLIC_UPLOAD_PREFIX}/`) ||
  new Set([imageUrl, ...images]).size < 3 ||
  images.some((url) => !url.startsWith(`${PUBLIC_UPLOAD_PREFIX}/`));

