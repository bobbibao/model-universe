export const MAX_PRODUCT_BULK = 50;
export type ProductBulkChanges = { condition?: string; conditionNodeIds?: number[]; isFeatured?: boolean };
export type ProductBulkIssue = {
  id: number;
  reason: 'retired' | 'uniqueIdentity' | 'photos' | 'missingAccessories' | 'defects';
};
export type ProductBulkResponse = { ok: true; result: ProductBulkResult } | { ok: false; issues?: ProductBulkIssue[] };
export type ProductBulkItem = { id: number; expectedUpdatedAt: string };
export type ProductBulkRequest = { requestKey: string; items: ProductBulkItem[]; changes: ProductBulkChanges };
export type ProductBulkResult = { selectedCount: number; updatedCount: number };
