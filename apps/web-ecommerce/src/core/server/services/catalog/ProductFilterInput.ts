import HttpError from '../../../../shared/server/utils/HttpError';

// Repeated query parameters are OR within a facet; separate facets remain AND on the same SKU.
// Legacy links with a single value remain valid.
export function parseFilterChoices(value: unknown): string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  if (list.length > 50 || list.some((item) => typeof item !== 'string' || item.length > 200))
    throw HttpError.badRequest('Invalid product filter.');
  return [...new Set((list as string[]).map((item) => item.trim()).filter(Boolean))];
}
