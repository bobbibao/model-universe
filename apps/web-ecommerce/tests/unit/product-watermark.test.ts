import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {
  originalPath,
  watermarkPhoto,
  watermarkStoredPhoto,
} from '../../src/core/server/services/media/ProductWatermark';

const photo = (width: number, height: number, format: 'png' | 'jpeg' = 'png') =>
  sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    [format]()
    .toBuffer();

describe('shop watermark on product photos', () => {
  it('stamps the mark in the bottom-right corner and caps the longer edge at 1600 px', async () => {
    const stamped = await watermarkPhoto(await photo(3200, 1600));
    const meta = await sharp(stamped).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 1600, height: 800 });
    const { data, info } = await sharp(stamped).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => data[(y * info.width + x) * info.channels];
    expect(pixel(10, 10)).toBeGreaterThan(245); // untouched corner
    expect(pixel(info.width - 60, info.height - 40)).toBeLessThan(220); // the mark's plate
  });

  it('keeps the format its file name says', async () => {
    expect((await sharp(await watermarkPhoto(await photo(800, 600, 'jpeg'), '.jpg')).metadata()).format).toBe('jpeg');
  });

  it('keeps the clean original once and stamps a stored photo only once', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-'));
    process.env.PRIVATE_UPLOAD_DIR = path.join(dir, 'private');
    try {
      const file = path.join(dir, 'a.webp');
      fs.writeFileSync(
        file,
        await sharp(await photo(900, 900))
          .webp()
          .toBuffer(),
      );
      const clean = fs.readFileSync(file);
      expect(await watermarkStoredPhoto(file)).toBe('stamped');
      expect(fs.readFileSync(originalPath(file))).toEqual(clean);
      expect(fs.readFileSync(file)).not.toEqual(clean);
      expect(await watermarkStoredPhoto(file)).toBe('kept');
      expect(await watermarkStoredPhoto(file, { force: true })).toBe('stamped');
      expect(fs.readFileSync(originalPath(file))).toEqual(clean);
    } finally {
      delete process.env.PRIVATE_UPLOAD_DIR;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
