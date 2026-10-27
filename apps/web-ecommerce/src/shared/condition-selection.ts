import { ancestors, normalizeSelection, type ConditionNode, type ItemTypeKey } from './condition-tree';

export const shortConditionLabel = (path: string) => {
  const parts = path.split(' / ').map((part) => part.trim());
  const leaf = parts[parts.length - 1] || path;
  if (/^(tay|chân|vai|khuỷu|đầu|thân|phần|left|right|head|torso|arm|leg|waist|elbow|shoulder)(\s|$)/i.test(leaf)) {
    const issue = parts
      .slice(0, -1)
      .reverse()
      .find((part) => /^(lỏng|gãy|thiếu|trầy|nứt|vết|loose|broken|missing|scratches|cracked|nub)(\s|$)/i.test(part));
    if (issue) return `${issue} · ${leaf}`;
  }
  return leaf;
};

// Derived ticks do not replace specific defect IDs with their broader parent in SKU identity.
export function conditionSelected(id: number, selected: readonly number[], nodes: readonly ConditionNode[]): boolean {
  if (selected.includes(id)) return true;
  const children = nodes.filter((node) => node.parentId === id && node.isActive);
  return children.length > 0 && children.every((child) => conditionSelected(child.id, selected, nodes));
}

export function toggleCondition(
  id: number,
  selected: readonly number[],
  nodes: readonly ConditionNode[],
  type: ItemTypeKey,
): number[] {
  const inBranch = (key: number) => key === id || ancestors(key, nodes).includes(id);
  if (conditionSelected(id, selected, nodes)) return selected.filter((key) => !inBranch(key));
  const path = [id, ...ancestors(id, nodes)];
  const remaining = selected.filter((key) => {
    const existing = [key, ...ancestors(key, nodes)];
    if (inBranch(key) || path.includes(key)) return false;
    return !nodes.some((group) => {
      if (group.selectionMode !== 'single') return false;
      const a = path.indexOf(group.id),
        b = existing.indexOf(group.id);
      return a > 0 && b > 0 && path[a - 1] !== existing[b - 1];
    });
  });
  return normalizeSelection([...remaining, id], nodes, type, selected);
}
