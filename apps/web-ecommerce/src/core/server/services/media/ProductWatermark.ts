import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// The shop's logo (BrandLogo: the cube mark and "MODEL UNIVERSE") stamped on every photo of a shop product, bottom
// right, about a third of the photo's width, white on a translucent dark plate so it reads on dark and light photos.
// The clean original of each photo is kept in private storage (never served), so the mark can be redrawn from it.

const MARK = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 64">
  <defs>
    <filter id="s" x="-20%" y="-40%" width="140%" height="180%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="360" height="64" rx="14" fill="#14121e" fill-opacity="0.38"/>
  <g filter="url(#s)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round" opacity="0.92">
    <path d="M32 6 58 20v24L32 58 6 44V20Z"/>
    <path d="m16 24 16 10 16-10M16 24v18l16 10 16-10V24M32 34v18M16 24l16-10 16 10"/>
  </g>
  <text x="72" y="42" filter="url(#s)" fill="#fff" fill-opacity="0.92" font-family="Arial, Helvetica, sans-serif"
    font-size="27" font-weight="700" textLength="278" lengthAdjust="spacingAndGlyphs">MODEL UNIVERSE</text>
</svg>`;

const MAX_EDGE = 1600;
const FORMATS: Record<string, 'webp' | 'jpeg' | 'png'> = {
  '.webp': 'webp',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
};

// The photo with the mark, in the format its extension names (default WebP), at most 1600 px on its longer edge.
export async function watermarkPhoto(input: Buffer, extension = '.webp'): Promise<Buffer> {
  const meta = await sharp(input).rotate().metadata();
  if (!meta.width || !meta.height) throw new Error('unreadable image');
  // EXIF orientation 5–8 swaps the stored width and height.
  const [w0, h0] = (meta.orientation ?? 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
  const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
  const width = Math.round(w0 * scale),
    height = Math.round(h0 * scale);
  const markWidth = Math.max(140, Math.min(width - 16, Math.round(width * 0.3)));
  const mark = await sharp(Buffer.from(MARK)).resize({ width: markWidth }).png().toBuffer();
  const markHeight = (await sharp(mark).metadata()).height ?? Math.round(markWidth / 5.6);
  const margin = Math.max(8, Math.round(Math.min(width, height) * 0.03));
  const image = sharp(input)
    .rotate()
    .resize({ width, height, fit: 'fill' })
    .composite([
      { input: mark, left: Math.max(0, width - markWidth - margin), top: Math.max(0, height - markHeight - margin) },
    ]);
  const format = FORMATS[extension.toLowerCase()] ?? 'webp';
  return format === 'jpeg'
    ? image.jpeg({ quality: 86, mozjpeg: true }).toBuffer()
    : format === 'png'
      ? image.png().toBuffer()
      : image.webp({ quality: 82 }).toBuffer();
}

// Private storage of the clean originals (PRIVATE_UPLOAD_DIR, as for evidence files), by the public file's name.
export const originalsRoot = () =>
  path.join(
    path.resolve(process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), '.private-uploads')),
    'product-originals',
  );
export const originalPath = (publicFile: string) => path.join(originalsRoot(), path.basename(publicFile));

// Stamps a stored public photo in place, keeping its clean original first. Without `force` a photo whose original
// is already kept is left alone (it carries the mark); with it the mark is redrawn from the original.
export async function watermarkStoredPhoto(publicFile: string, { force = false } = {}): Promise<'stamped' | 'kept'> {
  const original = originalPath(publicFile);
  if (fs.existsSync(original) && !force) return 'kept';
  if (!fs.existsSync(original)) {
    fs.mkdirSync(originalsRoot(), { recursive: true });
    fs.copyFileSync(publicFile, original);
  }
  const stamped = await watermarkPhoto(fs.readFileSync(original), path.extname(publicFile));
  const temporary = `${publicFile}.tmp`;
  fs.writeFileSync(temporary, stamped);
  fs.renameSync(temporary, publicFile);
  return 'stamped';
}
