// Stable IDs identify conditions. Labels and positions may change without changing a SKU's identity.
export const ITEM_TYPES = ['new', 'preowned'] as const;
export type ItemTypeKey = (typeof ITEM_TYPES)[number];
export interface ConditionNode {
  id: number;
  parentId: number | null;
  key: string;
  nameVi: string;
  nameEn: string;
  description: string | null;
  selectable: boolean;
  selectionMode: 'multiple' | 'single';
  itemTypes: ItemTypeKey[];
  sortOrder: number;
  isActive: boolean;
  version: number;
  productCount?: number;
}
export interface ConditionSelection {
  modelFamilyId?: number | null;
  itemTypeKey?: ItemTypeKey;
  conditionNodeIds?: number[];
  conditionLabels?: string[];
  catalogReviewRequired?: boolean;
}
export const itemTypeLabel = (key?: string) => (key === 'new' ? 'New' : '2hand');
// The additive column defaults to New on legacy rows. Read their original condition until reviewed migration.
export const effectiveItemType = (product: {
  modelFamilyId?: number | null;
  itemTypeKey?: string;
  condition?: string;
}): ItemTypeKey =>
  product.modelFamilyId && ITEM_TYPES.includes(product.itemTypeKey as ItemTypeKey)
    ? (product.itemTypeKey as ItemTypeKey)
    : product.condition === 'new'
      ? 'new'
      : 'preowned';
export const nodeLabel = (node: ConditionNode, en = false) => (en ? node.nameEn : node.nameVi) || node.nameVi;
export function ancestors(id: number, nodes: readonly ConditionNode[]): number[] {
  const result: number[] = [];
  const seen = new Set<number>([id]);
  let parent = nodes.find((node) => node.id === id)?.parentId;
  while (parent != null) {
    if (seen.has(parent)) throw new Error('Cây tình trạng không được có vòng lặp.');
    seen.add(parent);
    result.push(parent);
    parent = nodes.find((node) => node.id === parent)?.parentId;
  }
  return result;
}
export function conditionPath(id: number, nodes: readonly ConditionNode[], en = false): string {
  return [...ancestors(id, nodes).reverse(), id]
    .map((key) => nodes.find((node) => node.id === key))
    .filter((node): node is ConditionNode => !!node)
    .map((node) => nodeLabel(node, en))
    .join(' / ');
}
export function normalizeSelection(
  raw: unknown,
  nodes: readonly ConditionNode[],
  type: ItemTypeKey,
  previous: readonly number[] = [],
): number[] {
  if (!ITEM_TYPES.includes(type)) throw new Error('Chọn loại hàng New hoặc 2hand.');
  if (!Array.isArray(raw) || raw.length > 100 || raw.some((id) => !Number.isSafeInteger(id) || id < 1))
    throw new Error('Danh sách tình trạng không hợp lệ (tối đa 100 lựa chọn).');
  const ids = [...new Set(raw as number[])].sort((a, b) => a - b);
  for (const id of ids) {
    const node = nodes.find((item) => item.id === id);
    if (!node?.selectable) throw new Error('Chọn tình trạng, không chọn nhóm.');
    const path = [id, ...ancestors(id, nodes)];
    if (
      !previous.includes(id) &&
      path.some((key) => {
        const current = nodes.find((item) => item.id === key);
        return !current?.isActive || !current.itemTypes.includes(type);
      })
    )
      throw new Error('Tình trạng đã ngừng dùng hoặc không áp dụng cho loại hàng này.');
  }
  // Selecting a specific defect replaces its broad ancestor, regardless of selection order.
  const leaves = ids.filter((id) => !ids.some((other) => other !== id && ancestors(other, nodes).includes(id)));
  for (const group of nodes.filter((node) => node.selectionMode === 'single')) {
    const branches = new Set<number>();
    for (const id of leaves) {
      const path = [id, ...ancestors(id, nodes)];
      const index = path.indexOf(group.id);
      if (index > 0) branches.add(path[index - 1]);
    }
    if (branches.size > 1) throw new Error(`Các lựa chọn trong “${group.nameVi}” loại trừ nhau.`);
  }
  return leaves;
}
export interface ServiceConditionCase extends ConditionSelection {
  otherCondition?: string;
}
export interface ConditionCaseSnapshot {
  modelFamilyId: number | null;
  itemTypeKey: ItemTypeKey;
  conditionNodeIds: number[];
  labels: string[];
  otherCondition: string;
  productId: number | null;
  salePriceVnd: number | null;
  approvedAt: string | null;
  capturedAt: string;
}
