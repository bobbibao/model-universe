import path from 'path';

// Whether a stored shop photo has a light (white or pale) edge: a white backdrop, white margins or box art, judged by
// the brightest of its four outer bands at 24x24. The navy services hub prefers the dark studio shots; a light edge
// shows as a pale box there.
// Results are cached per file for the life of the process; an unreadable file counts as dark (it is not excluded).
const cache = new Map<string, boolean>();
const SIZE = 24;
const BAND = 2;
const LIGHT_LUMA = 200;

export async function hasLightEdge(src: string): Promise<boolean> {
  const cached = cache.get(src);
  if (cached !== undefined) return cached;
  let light = false;
  try {
    const relative = src.replace(/^\/uploads\//, '');
    const root = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return false;
    const { default: sharp } = await import('sharp');
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
    light = Math.max(...bands) / (SIZE * BAND) > LIGHT_LUMA;
  } catch {
    light = false;
  }
  cache.set(src, light);
  return light;
}
