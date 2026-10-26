import { PUBLIC_UPLOAD_PREFIX } from '../FileStorageService';

// Shop catalog rule: one unit and an uploaded actual-item main photo; gallery photos are optional.
export const uniquePhotosMissing = (stock: number, imageUrl: string) =>
  stock > 1 || !imageUrl.startsWith(`${PUBLIC_UPLOAD_PREFIX}/`);
