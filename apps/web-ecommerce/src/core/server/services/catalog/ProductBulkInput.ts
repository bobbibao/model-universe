import HttpError from '../../../../shared/server/utils/HttpError';
import { MAX_PRODUCT_BULK, type ProductBulkChanges, type ProductBulkRequest } from '../../../../shared/product-bulk';

const invalid = () =>
  HttpError.badRequest('Choose up to 50 products and supported fields only.', undefined, 'BULK_PRODUCT_INVALID');
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export function parseProductBulk(value: unknown): ProductBulkRequest {
  if (!record(value) || Object.keys(value).some((key) => !['requestKey', 'items', 'changes'].includes(key)))
    throw invalid();
  if (
    typeof value.requestKey !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.requestKey)
  )
    throw invalid();
  if (!Array.isArray(value.items) || !value.items.length || value.items.length > MAX_PRODUCT_BULK) throw invalid();
  const items = value.items
    .map((item: unknown) => {
      if (
        !record(item) ||
        Object.keys(item).some((key) => !['id', 'expectedUpdatedAt'].includes(key)) ||
        typeof item.id !== 'number' ||
        !Number.isSafeInteger(item.id) ||
        item.id <= 0 ||
        typeof item.expectedUpdatedAt !== 'string' ||
        !Number.isFinite(Date.parse(item.expectedUpdatedAt))
      )
        throw invalid();
      return { id: item.id, expectedUpdatedAt: new Date(item.expectedUpdatedAt).toISOString() };
    })
    .sort((a, b) => a.id - b.id);
  if (new Set(items.map((item) => item.id)).size !== items.length || !record(value.changes)) throw invalid();
  const keys = ['condition', 'isFeatured'] as const;
  if (
    !Object.keys(value.changes).length ||
    Object.keys(value.changes).some((key) => !(keys as readonly string[]).includes(key))
  )
    throw invalid();
  const changes: ProductBulkChanges = {};
  if (Object.prototype.hasOwnProperty.call(value.changes, 'condition')) {
    const next = value.changes.condition;
    if (typeof next !== 'string' || !next.trim() || next.trim().length > 80) throw invalid();
    changes.condition = next.trim();
  }
  if (Object.prototype.hasOwnProperty.call(value.changes, 'isFeatured')) {
    if (typeof value.changes.isFeatured !== 'boolean') throw invalid();
    changes.isFeatured = value.changes.isFeatured;
  }
  return { requestKey: value.requestKey.toLowerCase(), items, changes };
}
