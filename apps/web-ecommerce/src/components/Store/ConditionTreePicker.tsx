'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { ancestors, conditionPath, nodeLabel, type ConditionNode, type ItemTypeKey } from '@/shared/condition-tree';
import { conditionSelected, shortConditionLabel, toggleCondition } from '@/shared/condition-selection';
import { useConditionTree } from '@/shared/client/hooks/useConditionTree';

interface Props {
  value: number[];
  onChange: (ids: number[]) => void;
  itemType: ItemTypeKey;
  disabled?: boolean;
  nodes?: ConditionNode[];
}
export default function ConditionTreePicker({ value, onChange, itemType, disabled, nodes: supplied }: Props) {
  const tree = useConditionTree();
  const nodes = supplied ?? tree.nodes;
  const en = useLocale() === 'en';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [closed, setClosed] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const selectedAncestors = useMemo(() => new Set(value.flatMap((id) => ancestors(id, nodes))), [value, nodes]);
  useEffect(() => {
    setOpen((current) =>
      [...selectedAncestors].every((id) => current.has(id)) ? current : new Set([...current, ...selectedAncestors]),
    );
  }, [selectedAncestors]);
  const available = nodes.filter(
    (node) =>
      (node.isActive &&
        node.itemTypes.includes(itemType) &&
        ancestors(node.id, nodes).every((id) => {
          const parent = nodes.find((item) => item.id === id);
          return parent?.isActive && parent.itemTypes.includes(itemType);
        })) ||
      value.includes(node.id),
  );
  const visible = (parentId: number | null, depth: number): { node: ConditionNode; depth: number }[] =>
    available
      .filter((node) => node.parentId === parentId)
      .flatMap((node) => [
        { node, depth },
        ...((open.has(node.id) || selectedAncestors.has(node.id)) && !closed.has(node.id)
          ? visible(node.id, depth + 1)
          : []),
      ]);
  const rows = query.trim()
    ? available
        .filter(
          (node) =>
            node.selectable &&
            conditionPath(node.id, nodes, en).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
        )
        .map((node) => ({ node, depth: 0 }))
    : visible(null, 0);
  const toggle = (id: number) => {
    if (disabled) return;
    try {
      onChange(toggleCondition(id, value, available, itemType));
      setError('');
    } catch (reason) {
      setError((reason as Error).message);
    }
  };
  return (
    <div className={`condition-tree-picker${disabled ? ' is-readonly' : ''}`}>
      <div className="condition-tree-search">
        <input
          aria-label={en ? 'Find a condition' : 'Tìm tình trạng'}
          placeholder={en ? 'Find box, joints, accessories…' : 'Tìm hộp, khớp, phụ kiện…'}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          disabled={disabled}
        />
        <span>{value.length}</span>
      </div>
      {tree.loading && !supplied && (
        <p className="condition-tree-empty" role="status">
          {en ? 'Loading conditions…' : 'Đang tải tình trạng…'}
        </p>
      )}
      {tree.failed && !supplied && (
        <button type="button" className="condition-tree-empty" onClick={tree.reload}>
          {en ? 'Could not load. Retry' : 'Không tải được. Thử lại'}
        </button>
      )}
      <div className="condition-tree-rows" role="group" aria-label={en ? 'Condition selection' : 'Chọn tình trạng'}>
        {rows.map(({ node, depth }) => {
          const children = available.some((item) => item.parentId === node.id);
          const expanded = (open.has(node.id) || selectedAncestors.has(node.id)) && !closed.has(node.id);
          return (
            <div
              key={node.id}
              className={`condition-tree-row${conditionSelected(node.id, value, available) ? ' is-selected' : ''}`}
              style={{ paddingInlineStart: `${12 + Math.min(depth, 8) * 16}px` }}
            >
              {children ? (
                <button
                  className="condition-tree-expand"
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${en ? 'Expand' : 'Mở nhánh'} ${nodeLabel(node, en)}`}
                  onClick={() => {
                    setClosed((current) => {
                      const next = new Set(current);
                      if (expanded) next.add(node.id);
                      else next.delete(node.id);
                      return next;
                    });
                    setOpen((current) => new Set([...current, node.id]));
                  }}
                >
                  {expanded ? '⌄' : '›'}
                </button>
              ) : (
                <span className="condition-tree-expand" />
              )}
              {node.selectable ? (
                <button
                  type="button"
                  className="condition-tree-choice"
                  aria-pressed={conditionSelected(node.id, value, available)}
                  disabled={disabled}
                  onClick={() => toggle(node.id)}
                >
                  <span>{query ? conditionPath(node.id, nodes, en) : nodeLabel(node, en)}</span>
                  <span aria-hidden="true">{conditionSelected(node.id, value, available) ? '✓' : ''}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="condition-tree-group"
                  aria-pressed={conditionSelected(node.id, value, available)}
                  aria-expanded={expanded}
                  onClick={() => {
                    if (!disabled && conditionSelected(node.id, value, available)) {
                      onChange(value.filter((id) => id !== node.id && !ancestors(id, nodes).includes(node.id)));
                      return;
                    }
                    setClosed((current) => {
                      const next = new Set(current);
                      next.delete(node.id);
                      return next;
                    });
                    setOpen((current) => new Set([...current, node.id]));
                  }}
                >
                  {nodeLabel(node, en)}
                  {conditionSelected(node.id, value, available) && (
                    <span className="condition-tree-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })}
        {!tree.loading && !rows.length && (
          <p className="condition-tree-empty">{en ? 'No matching condition' : 'Không có tình trạng phù hợp'}</p>
        )}
      </div>
      <div className="condition-selection-tags">
        {value.length ? (
          value.map((id) => (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(id)}
              title={conditionPath(id, nodes, en)}
              aria-label={`${en ? 'Remove' : 'Bỏ'} ${shortConditionLabel(conditionPath(id, nodes, en))}`}
            >
              {shortConditionLabel(conditionPath(id, nodes, en))} <span aria-hidden="true">×</span>
            </button>
          ))
        ) : (
          <span>{en ? 'No issues recorded' : 'Không ghi nhận lỗi'}</span>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
