/**
 * Text normalization utilities for search.
 * Handles Vietnamese accents/diacritics removal, unspaced/joined names, case-insensitivity,
 * tokenization, and domain descriptor filtering (e.g., "mô hình", "figure").
 */

/**
 * Strips Vietnamese diacritics and converts special characters like đ/Đ -> d/D.
 * Preserves alphanumeric characters and spaces.
 */
export function removeDiacritics(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Normalizes text for standard search comparisons:
 * - lowercases
 * - removes diacritics
 * - replaces punctuation with space (preserving hyphens inside codes)
 * - collapses consecutive whitespaces
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return removeDiacritics(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/u, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips all spaces, hyphens, and non-alphanumeric characters into a continuous compact string.
 * This allows matching:
 *   "Ao Binh", "aobing", "AoBing" -> "aobing"
 *   "Natra", "na tra", "Na Tra" -> "natra"
 *   "ngao bính", "ngao binh" -> "ngaobinh"
 *   "MNP-XH03" -> "mnpxh03"
 */
export function compactText(text: string): string {
  if (!text) return '';
  return removeDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Tokenizes text into an array of distinct normalized words.
 * Splits on spaces and non-alphanumeric punctuation.
 */
export function tokenize(text: string): string[] {
  const norm = normalizeSearchText(text);
  if (!norm) return [];
  return norm.split(/[\s-]+/).filter((token) => token.length > 0);
}

/**
 * Generic product category and hobby descriptors often appended to character queries:
 * e.g., "mô hình", "figure", "kit", "lắp ráp", "chính hãng".
 */
export const DESCRIPTOR_TOKENS = new Set<string>([
  'mo',
  'hinh',
  'mohinh',
  'figure',
  'fig',
  'kit',
  'lap',
  'rap',
  'laprap',
  'do',
  'choi',
  'dochoi',
  'gundam',
  'gunpla',
  'chinh',
  'hang',
  'chinhhang',
  'phien',
  'ban',
  'phienban',
  'ver',
  'version',
  'mau',
  'color',
  'metal',
  'build',
  'metalbuild',
  'mb',
  'scale',
  'ti',
  'le',
  'tile',
  'gia',
  'tot',
  'chinh',
  'hang',
  'full',
  'box',
  'fullbox',
]);

/**
 * Returns true if the token is a generic descriptor/stop-word in figure/kit commerce.
 */
export function isDescriptorToken(token: string): boolean {
  const norm = compactText(token);
  return DESCRIPTOR_TOKENS.has(norm);
}

/**
 * Separates query tokens into core intent tokens and descriptor tokens.
 * e.g. ["na", "tra", "mo", "hinh"] -> { core: ["na", "tra"], descriptors: ["mo", "hinh"] }
 */
export function partitionQueryTokens(tokens: string[]): {
  core: string[];
  descriptors: string[];
} {
  const core: string[] = [];
  const descriptors: string[] = [];

  for (const token of tokens) {
    if (isDescriptorToken(token)) {
      descriptors.push(token);
    } else {
      core.push(token);
    }
  }

  // If all tokens happen to be descriptors (e.g. searching "mô hình"), preserve them as core.
  if (core.length === 0) {
    return { core: descriptors, descriptors: [] };
  }

  return { core, descriptors };
}
