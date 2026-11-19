import path from 'path';

// What the storefront needs to know about a stored shop photo before showing it large: its size in pixels, and
// whether it has a light (white or pale) edge, a white backdrop, white margins or box art, judged by the brightest of
// its four outer bands at 24x24. The services hero prefers sharp dark studio shots; a light edge shows as a pale box.
// Results are cached per file for the life of the process; an unreadable file counts as a dark photo of unknown size.
export type PhotoFacts = { width: number; height: number; light: boolean };
const cache = new Map<string, PhotoFacts>();
const SIZE = 24;
const BAND = 2;
const LIGHT_LUMA = 200;

export async function photoFacts(src: string): Promise<PhotoFacts> {
  const cached = cache.get(src);
  if (cached) return cached;
  let facts: PhotoFacts = { width: 0, height: 0, light: false };
  try {
    const relative = src.replace(/^\/uploads\//, '');
    const root = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return facts;
    const { default: sharp } = await import('sharp');
    const meta = await sharp(file).metadata();
    const { data, info } = await sharp(file)
      .resize(SIZE, SIZE, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const luma = (x: number, y: number) => {
      const i = (y * SIZE + x) * info.channels;
      return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    };
    // Mean brightness of the top, bottom, left and right bands.
    const bands = [0, 0, 0, 0];
    for (let a = 0; a < SIZE; a++)
      for (let b = 0; b < BAND; b++) {
        bands[0] += luma(a, b);
        bands[1] += luma(a, SIZE - 1 - b);
        bands[2] += luma(b, a);
        bands[3] += luma(SIZE - 1 - b, a);
      }
    // EXIF orientations 5 to 8 turn the photo a quarter: its width is the stored height.
    const turned = (meta.orientation ?? 1) >= 5;
    facts = {
      width: (turned ? meta.height : meta.width) ?? 0,
      height: (turned ? meta.width : meta.height) ?? 0,
      light: Math.max(...bands) / (SIZE * BAND) > LIGHT_LUMA,
    };
  } catch {
    facts = { width: 0, height: 0, light: false };
  }
  cache.set(src, facts);
  return facts;
}

export async function hasLightEdge(src: string): Promise<boolean> {
  return (await photoFacts(src)).light;
}
