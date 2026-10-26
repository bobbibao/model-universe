'use client';
import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import Api from '@/core/client/api/Api';
import ConditionTreePicker from '@/components/Store/ConditionTreePicker';
import TextAreaField from '@/components/FormElements/TextAreaField';
import type { ConditionCaseSnapshot, ItemTypeKey } from '@/shared/condition-tree';

export default function ServiceConditionSelector({
  familyId,
  type,
  ids,
  other,
  onChange,
  onMatch,
}: {
  familyId?: number | null;
  type: ItemTypeKey;
  ids: number[];
  other: string;
  onChange: (change: { condition?: ItemTypeKey; conditionNodeIds?: number[]; otherCondition?: string }) => void;
  onMatch: (snapshot: ConditionCaseSnapshot | null) => void;
}) {
  const en = useLocale() === 'en';
  const callback = useRef(onMatch);
  callback.current = onMatch;
  const selected = ids.join(',');
  useEffect(() => {
    let current = true;
    callback.current(null);
    const timer = setTimeout(() => {
      Api.post('/product-condition-tree/match', {
        modelFamilyId: familyId ?? null,
        itemTypeKey: type,
        conditionNodeIds: selected ? selected.split(',').map(Number) : [],
        otherCondition: other,
      })
        .then((response) => {
          if (current) callback.current(response.data);
        })
        .catch(() => {
          if (current) callback.current(null);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [familyId, type, selected, other]);
  return (
    <div className="service-condition-selector">
      <div className="sb-segment" role="radiogroup" aria-label={en ? 'Item type' : 'Loại hàng'}>
        {(['new', 'preowned'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => onChange({ condition: value, conditionNodeIds: [] })}
          >
            {value === 'new' ? 'New' : '2hand'}
          </button>
        ))}
      </div>
      <details>
        <summary>{en ? `Select conditions (${ids.length})` : `Chọn tình trạng (${ids.length})`}</summary>
        <ConditionTreePicker
          value={ids}
          itemType={type}
          onChange={(conditionNodeIds) => onChange({ conditionNodeIds })}
        />
      </details>
      <TextAreaField
        name="otherCondition"
        label={en ? 'Your case is not listed?' : 'Chưa có tình trạng của bạn?'}
        placeholder={en ? 'Describe it; the shop will review and quote.' : 'Mô tả để shop xem, duyệt và báo giá.'}
        rows={2}
        maxLength={2000}
        value={other}
        onChange={(event) => onChange({ otherCondition: event.target.value })}
      />
    </div>
  );
}
