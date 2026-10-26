import { PUBLIC_UPLOAD_PREFIX } from '../FileStorageService';

// Shop catalog rule: an uploaded actual-item main photo; gallery photos are optional.
export const uniquePhotosMissing = (_stock: number, imageUrl: string) =>
  !imageUrl.startsWith(`${PUBLIC_UPLOAD_PREFIX}/`);
