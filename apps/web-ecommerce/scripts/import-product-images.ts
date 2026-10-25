/* `yarn images:import <sheet.csv> [--limit N] [--only key,key] [--dry-run] [--report data/image_import_report.csv]`:
 * the product photos of the owner's workbook "MODEL UNIVERSE - Danh mục 6 hãng và phiên bản" (column "Hình ảnh").
 *
 * Every link of a row is classified (ProductImageSources.ts): a direct image is downloaded; a product page is fetched
 * and its og:image, JSON-LD Product.image and main gallery are taken (logos, icons and images under 400 px dropped);
 * a Google Drive file link becomes its download link; Facebook and other social links are left for a person
 * ("manual"). Each download must be an image; duplicates are dropped by the hash of the downloaded bytes; photos are
 * resized to at most 1600 px, stamped with the shop's mark (ProductWatermark.ts; the clean original kept privately) and
 * stored as WebP under the upload root (`/uploads/products/<hash>.webp`).
 *
 * Running it again changes nothing: a file is named by its source hash and a product photo is added only once. The
 * first imported photo replaces a main photo that is not an upload of the shop (a placeholder or a hotlinked image);
 * the others are added to the gallery. Every link gets a row in the report: product_key, source_url, status
 * (ok / manual / failed), reason, images. `--dry-run` downloads and checks but writes no file and no database row.
 */
export {}; // a module: its names do not collide with the other scripts in the server build

process.env.SEED_DATA = 'false';
process.env.DROP_TABLES = 'false';
process.env.STRICT_SEED = 'true';

/* eslint-disable @typescript-eslint/no-var-requires */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { parse } = require('csv-parse/sync');
const DatabaseProvider = require('../src/core/server/database/Database.Provider').default;
const ProductModel = require('../src/core/server/database/client/models/Product.Model').default;
const ProductImageModel = require('../src/core/server/database/client/models/ProductImage.Model').default;
const ProductSourceModel = require('../src/core/server/database/client/models/ProductSource.Model').default;
const FileStorageService = require('../src/core/server/services/FileStorageService').default;
const { originalPath, watermarkStoredPhoto } = require('../src/core/server/services/media/ProductWatermark');
const { parseOwnerCatalogCsv } = require('../src/core/server/database/client/seeders/OwnerCatalog');
const {
  classifyLink,
  differenceHash,
  sameShot,
  driveDownloadUrl,
  extractPageImages,
  splitLinks,
} = require('../src/core/server/services/catalog/ProductImageSources');
/* eslint-enable @typescript-eslint/no-var-requires */

const MAX_EDGE = 1600;
const MIN_EDGE = 400;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PHOTOS_PER_LINK = 8;
const TIMEOUT_MS = 20_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const csvPath = args.find((arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--'));
const dryRun = args.includes('--dry-run');
const limit = Number(option('--limit')) || Infinity;
const only = option('--only')
  ?.split(',')
  .map((key) => key.trim());
const reportPath = path.resolve(option('--report') ?? 'data/image_import_report.csv');

interface ReportRow {
  product_key: string;
  source_url: string;
  status: 'ok' | 'manual' | 'failed';
  reason: string;
  images: number;
}
interface Photo {
  hash: string;
  shot: string;
  pixels: number;
  webp: Buffer;
}

// Adds a photo unless the same shot is already there; of two sizes of one shot the larger is kept.
const addDistinct = (photos: Photo[], photo: Photo) => {
  const same = photos.findIndex((known) => known.hash === photo.hash || sameShot(known.shot, photo.shot));
  if (same < 0) photos.push(photo);
  else if (photo.pixels > photos[same].pixels) photos[same] = photo;
};

const fetchWith = async (url: string, accept: string) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'vi,en;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length'));
  if (length > MAX_BYTES) throw new Error(`too large (${length} bytes)`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_BYTES) throw new Error(`too large (${body.length} bytes)`);
  return { body, type: (response.headers.get('content-type') ?? '').toLowerCase(), finalUrl: response.url };
};

// Downloads one image and converts it; the reason when it is not a usable product photo.
const downloadPhoto = async (url: string, allowOctetStream = false): Promise<Photo | string> => {
  let file;
  try {
    file = await fetchWith(url, 'image/avif,image/webp,image/*;q=0.9,*/*;q=0.5');
  } catch (error) {
    return `download failed: ${(error as Error).message}`;
  }
  const isImage =
    file.type.startsWith('image/') || (allowOctetStream && file.type.startsWith('application/octet-stream'));
  if (!isImage) return `not an image (${file.type || 'no content-type'})`;
  if (file.type.includes('svg')) return 'vector image (logo or icon)';
  try {
    const meta = await sharp(file.body, { failOn: 'error' }).metadata();
    if (!meta.width || !meta.height) return 'unreadable image';
    if (meta.width < MIN_EDGE || meta.height < MIN_EDGE) return `too small (${meta.width}×${meta.height})`;
    const webp = await sharp(file.body, { failOn: 'error' })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    // From the stored WebP, as for photos already stored, so both sides of a comparison are hashed alike.
    const gray = await sharp(webp).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
    return {
      hash: crypto.createHash('sha256').update(file.body).digest('hex'),
      shot: differenceHash(gray),
      pixels: meta.width * meta.height,
      webp,
    };
  } catch (error) {
    return `unreadable image: ${(error as Error).message}`;
  }
};

// The photos of one link, with its report status.
const photosOf = async (link: string): Promise<{ photos: Photo[]; status: ReportRow['status']; reason: string }> => {
  const kind = classifyLink(link);
  if (kind === 'facebook') return { photos: [], status: 'manual', reason: 'facebook link: copy the photos by hand' };
  if (kind === 'other') return { photos: [], status: 'manual', reason: 'social or unsupported link: copy by hand' };
  let candidates: string[] = [link];
  if (kind === 'drive') {
    const download = driveDownloadUrl(link);
    if (!download) return { photos: [], status: 'manual', reason: 'drive folder or link without a file id' };
    candidates = [download];
  } else if (kind === 'page') {
    try {
      const page = await fetchWith(link, 'text/html,application/xhtml+xml');
      if (!page.type.includes('html')) {
        if (page.type.startsWith('image/')) candidates = [link];
        else return { photos: [], status: 'failed', reason: `page is not HTML (${page.type})` };
      } else candidates = extractPageImages(page.body.toString('utf8'), page.finalUrl || link);
    } catch (error) {
      return { photos: [], status: 'failed', reason: `page fetch failed: ${(error as Error).message}` };
    }
    if (!candidates.length) return { photos: [], status: 'failed', reason: 'no og:image, JSON-LD image or gallery' };
  }
  const photos: Photo[] = [];
  const reasons: string[] = [];
  for (const candidate of candidates) {
    if (photos.length >= MAX_PHOTOS_PER_LINK) break;
    const photo = await downloadPhoto(candidate, kind === 'drive');
    if (typeof photo === 'string') reasons.push(photo);
    else addDistinct(photos, photo);
  }
  if (photos.length)
    return { photos, status: 'ok', reason: reasons.length ? `${reasons.length} candidate(s) skipped` : '' };
  return { photos, status: 'failed', reason: [...new Set(reasons)].slice(0, 3).join('; ') || 'no usable image' };
};

// A photo this import stored (`<source hash>.webp`), and the shot of a stored file (null when it cannot be read).
const IMPORTED = /^\/uploads\/products\/[0-9a-f]{32}\.webp$/;
// The clean original of a stored photo when it carries the shop's mark (the shot is compared without the mark).
const cleanFile = (file: string) => (fs.existsSync(originalPath(file)) ? originalPath(file) : file);
const shotOfFile = async (file: string): Promise<string | null> => {
  try {
    return differenceHash(await sharp(file).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer());
  } catch {
    return null;
  }
};

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

DatabaseProvider.initialize()
  .then(async () => {
    if (!csvPath) throw new Error('Pass the CSV exported from the "Danh mục 6 hãng" tab.');
    const csv = fs.readFileSync(csvPath, 'utf8');
    const rows = parseOwnerCatalogCsv(csv);
    const records: Record<string, string>[] = parse(csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv, {
      columns: (header: string[]) => header.map((name) => name.trim()),
      skip_empty_lines: true,
      trim: true,
    }).filter((record: Record<string, string>) => (record['Tên sản phẩm (mã + tên + phiên bản màu)'] ?? '').trim());
    if (records.length !== rows.length) throw new Error('The CSV rows do not match the parsed catalogue rows.');
    const imageColumn = Object.keys(records[0] ?? {}).find((name) => name.startsWith('Hình ảnh'));
    if (!imageColumn) throw new Error('The CSV has no column "Hình ảnh".');
    const sources = await ProductSourceModel.findAll({ attributes: ['catalogKey', 'productId'] });
    const productIdOf = new Map(
      sources.map((source: { catalogKey: string; productId: number }) => [source.catalogKey, source.productId]),
    );
    const folder = path.join(FileStorageService.getUploadRoot(), 'products');
    if (!dryRun) fs.mkdirSync(folder, { recursive: true });
    const report: ReportRow[] = [];
    let done = 0;
    for (const [index, row] of rows.entries()) {
      if (only && !only.includes(row.key)) continue;
      if (done >= limit) break;
      done++;
      const links = splitLinks(records[index][imageColumn] ?? '');
      const productId = productIdOf.get(row.key);
      const product = productId ? await ProductModel.findByPk(productId) : null;
      if (!links.length) {
        report.push({
          product_key: row.key,
          source_url: '',
          status: 'failed',
          reason: 'no link in the sheet',
          images: 0,
        });
        continue;
      }
      // The product's photos across all its links, one per shot.
      const chosen: Photo[] = [];
      const fromLink = new Map<Photo, number>();
      for (const link of links) {
        const result = await photosOf(link);
        for (const photo of result.photos) {
          addDistinct(chosen, photo);
          if (chosen.includes(photo)) fromLink.set(photo, report.length);
        }
        report.push({
          product_key: row.key,
          source_url: link,
          status: !product && result.status === 'ok' ? 'failed' : result.status,
          reason: !product && result.status === 'ok' ? 'no product for this catalogue key' : result.reason,
          images: 0,
        });
      }
      for (const photo of chosen) report[fromLink.get(photo)!].images++;
      if (!product || !chosen.length || dryRun) continue;
      // The photos this import stored before, by shot: a site may serve the same photo with other bytes on a later run,
      // so a known shot is never added twice, and same-shot copies already in the gallery are removed.
      const gallery: { id: number; url: string; sortOrder: number; destroy: () => Promise<void> }[] =
        await ProductImageModel.findAll({ where: { productId: product.id }, order: [['sortOrder', 'ASC']] });
      // When every link was read, an imported photo its source no longer shows (a related product the former gallery
      // rule took) is removed too. A link that failed this time removes nothing.
      const complete = report.slice(-links.length).every((line) => line.status !== 'failed');
      const shots: string[] = [];
      let mainGone = false;
      const kept: typeof gallery = [];
      for (const url of [product.imageUrl, ...gallery.map((image) => image.url)]) {
        const shot = IMPORTED.test(url ?? '')
          ? await shotOfFile(cleanFile(path.join(folder, path.basename(url))))
          : null;
        const image = gallery.find((row) => row.url === url);
        const stale = !!shot && complete && !chosen.some((photo) => sameShot(photo.shot, shot));
        const copy = !!shot && shots.some((known) => sameShot(known, shot));
        if (image && (stale || copy)) await image.destroy();
        else if (!image && stale) mainGone = true;
        else {
          if (shot) shots.push(shot);
          if (image) kept.push(image);
        }
      }
      gallery.splice(0, gallery.length, ...kept);
      let replaceMain = !product.imageUrl?.startsWith('/uploads/');
      if (mainGone) {
        // The next imported photo becomes the main one.
        const next = gallery.find((image) => IMPORTED.test(image.url));
        if (next) await product.update({ imageUrl: next.url });
        else replaceMain = true;
        if (next) {
          await next.destroy();
          gallery.splice(gallery.indexOf(next), 1);
        }
      }
      const known = new Set([product.imageUrl, ...gallery.map((image) => image.url)]);
      const urls: string[] = [];
      for (const photo of chosen) {
        const url = `/uploads/products/${photo.hash.slice(0, 32)}.webp`;
        if (known.has(url) || shots.some((shot) => sameShot(shot, photo.shot))) continue;
        const file = path.join(folder, path.basename(url));
        if (!fs.existsSync(file)) {
          fs.writeFileSync(file, photo.webp);
          await watermarkStoredPhoto(file);
        }
        shots.push(photo.shot);
        urls.push(url);
      }
      const additions = [...urls];
      if (replaceMain && urls.length) {
        await product.update({ imageUrl: urls[0] });
        additions.shift();
      }
      let sortOrder = Math.max(-1, ...gallery.map((image) => image.sortOrder));
      for (const url of additions)
        await ProductImageModel.create({ productId: product.id, url, sortOrder: ++sortOrder });
      console.log(`${row.key}: ${chosen.length} distinct photo(s), ${urls.length} new`);
    }
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    const columns: (keyof ReportRow)[] = ['product_key', 'source_url', 'status', 'reason', 'images'];
    fs.writeFileSync(
      reportPath,
      [columns.join(','), ...report.map((line) => columns.map((column) => csvCell(line[column])).join(','))].join(
        '\n',
      ) + '\n',
    );
    const count = (status: string) => report.filter((line) => line.status === status).length;
    console.log(
      `${dryRun ? '(dry run) ' : ''}${done} product(s), ${report.length} link(s): ${count('ok')} ok, ${count('manual')} manual, ${count('failed')} failed. Report: ${reportPath}`,
    );
    await DatabaseProvider.getInstance().close();
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('image import failed:', error);
    process.exit(1);
  });
