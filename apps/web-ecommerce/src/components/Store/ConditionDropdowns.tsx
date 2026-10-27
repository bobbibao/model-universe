'use client';
import { useLocale } from 'next-intl';
import FilterMultiSelect from '@/components/FormElements/FilterMultiSelect';
import { ancestors, nodeLabel, type ConditionNode, type ItemTypeKey } from '@/shared/condition-tree';
import { shortConditionLabel, toggleCondition } from '@/shared/condition-selection';

export default function ConditionDropdowns({
  nodes,
  value,
  itemType,
  onChange,
}: {
  nodes: ConditionNode[];
  value: number[];
  itemType: ItemTypeKey;
  onChange: (ids: number[]) => void;
}) {
  const en = useLocale() === 'en';
  const available = nodes.filter(
    (node) =>
      node.isActive &&
      node.itemTypes.includes(itemType) &&
      ancestors(node.id, nodes).every((id) => {
        const parent = nodes.find((row) => row.id === id);
        return parent?.isActive && parent.itemTypes.includes(itemType);
      }),
  );
  const choices = (parentId: number): ConditionNode[] =>
    available
      .filter((node) => node.parentId === parentId)
      .flatMap((node) => (node.selectable ? [node] : choices(node.id)));
  const branchContains = (id: number, key: number) => key === id || ancestors(key, nodes).includes(id);
  const render = (parent: ConditionNode, depth = 0): React.ReactNode => {
    const options = choices(parent.id);
    if (!options.length) return null;
    const selected = options.filter((option) => value.some((id) => branchContains(option.id, id)));
    return (
      <div key={parent.id} className={`condition-cascade ${depth ? 'is-detail' : ''}`}>
        <FilterMultiSelect
          inline
          label={
            depth
              ? `${en ? 'More about' : 'Chi tiết'} ${nodeLabel(parent, en).toLocaleLowerCase(en ? 'en' : 'vi')} (${en ? 'optional' : 'tùy chọn'})`
              : nodeLabel(parent, en)
          }
          placeholder={
            depth ? (en ? 'Add details if needed' : 'Bổ sung nếu cần') : en ? 'Choose if applicable' : 'Chọn nếu có'
          }
          clearLabel={en ? 'Clear selection' : 'Bỏ lựa chọn'}
          options={options.map((node) => ({ value: String(node.id), label: nodeLabel(node, en) }))}
          values={selected.map((node) => String(node.id))}
          onChange={(next) => {
            const added = next.map(Number).find((id) => !selected.some((node) => node.id === id));
            if (added) onChange(toggleCondition(added, value, available, itemType));
            else {
              const removed = selected.filter((node) => !next.includes(String(node.id)));
              onChange(value.filter((id) => !removed.some((node) => branchContains(node.id, id))));
            }
          }}
        />
        {selected.map((node) => render(node, depth + 1))}
      </div>
    );
  };
  return (
    <div className="condition-cascade-layout">
      <div className="condition-cascade-grid">
        {available.filter((node) => node.parentId === null).map((node) => render(node))}
      </div>
      {!!value.length && (
        <div className="condition-selection-summary">
          <span>
            {en ? 'Selected' : 'Đã chọn'} · {value.length}
          </span>
          <div className="condition-selection-tags" aria-label={en ? 'Selected conditions' : 'Tình trạng đã chọn'}>
            {value.map((id) => (
              <button
                type="button"
                key={id}
                title={nodes.find((node) => node.id === id)?.nameVi}
                aria-label={`${en ? 'Remove' : 'Bỏ'} ${nodeLabel(
                  nodes.find((node) => node.id === id)!,
                  en,
                )}`}
                onClick={() => onChange(value.filter((key) => key !== id))}
              >
                {shortConditionLabel(
                  nodeLabel(
                    nodes.find((node) => node.id === id)!,
                    en,
                  ),
                )}{' '}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
