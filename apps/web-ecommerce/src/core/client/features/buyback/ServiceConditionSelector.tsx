'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Api from '@/core/client/api/Api';
import ConditionDropdowns from '@/components/Store/ConditionDropdowns';
import TextAreaField from '@/components/FormElements/TextAreaField';
import { shortConditionLabel } from '@/shared/condition-selection';
import { useConditionTree } from '@/shared/client/hooks/useConditionTree';
import { conditionPath, type ConditionCaseSnapshot, type ItemTypeKey } from '@/shared/condition-tree';
import { tierBuyback, buybackMargin } from '@/shared/buyback-pricing';
import { pawnC50 } from '@/shared/pawn-rules';
import { formatVND } from '@/shared/server/utils/utils';

type Combination = { productId: number; itemTypeKey: ItemTypeKey; conditionNodeIds: number[]; salePriceVnd: number };
export default function ServiceConditionSelector({
  familyId,
  type,
  ids,
  other,
  kind = 'sell',
  onChange,
  onMatch,
}: {
  familyId?: number | null;
  type: ItemTypeKey;
  ids: number[];
  other: string;
  kind?: 'sell' | 'trade' | 'pawn';
  onChange: (change: { condition?: ItemTypeKey; conditionNodeIds?: number[]; otherCondition?: string }) => void;
  onMatch: (snapshot: ConditionCaseSnapshot | null) => void;
}) {
  const locale = useLocale(),
    en = locale === 'en';
  const tree = useConditionTree();
  const callback = useRef(onMatch);
  callback.current = onMatch;
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [matching, setMatching] = useState(true),
    [failed, setFailed] = useState(false);
  const [match, setMatch] = useState<ConditionCaseSnapshot | null>(null);
  const [more, setMore] = useState(false);
  const selected = ids.join(',');
  useEffect(() => {
    let current = true;
    setCombinations([]);
    if (familyId)
      Api.get(`/product-condition-tree/families/${familyId}/combinations`)
        .then((response) => {
          if (current) setCombinations(response.data);
        })
        .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [familyId]);
  useEffect(() => {
    let current = true;
    callback.current(null);
    setMatch(null);
    setMatching(true);
    setFailed(false);
    const timer = setTimeout(() => {
      Api.post('/product-condition-tree/match', {
        modelFamilyId: familyId ?? null,
        itemTypeKey: type,
        conditionNodeIds: selected ? selected.split(',').map(Number) : [],
        otherCondition: other,
      })
        .then((response) => {
          if (current) {
            callback.current(response.data);
            setMatch(response.data);
          }
        })
        .catch(() => {
          if (current) setFailed(true);
        })
        .finally(() => {
          if (current) setMatching(false);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [familyId, type, selected, other]);
  const available = combinations.filter((option) => option.itemTypeKey === type);
  const label = (option: Combination) =>
    option.conditionNodeIds
      .map((id) => {
        const node = tree.nodes.find((row) => row.id === id);
        return node ? shortConditionLabel(conditionPath(node.id, tree.nodes, en)) : '';
      })
      .filter(Boolean)
      .join(' · ') || (en ? 'No issues recorded' : 'Không ghi nhận lỗi');
  const quoted = (price: number) =>
    kind === 'pawn' ? pawnC50(price) : price > 100000 && buybackMargin(price) < price ? tierBuyback(price) : null;
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
      {!!available.length && (
        <section
          className="service-combinations"
          aria-label={en ? 'Combinations with a reference price' : 'Tổ hợp có báo giá'}
        >
          <div className="service-combinations-heading">
            <span>{en ? 'Quick selection · priced combinations' : 'Chọn nhanh · tổ hợp có báo giá'}</span>
            <small>{available.length}</small>
          </div>
          <div className="service-combinations-options">
            {(more ? available : available.slice(0, 4)).map((option) => {
              const active =
                !other.trim() &&
                [...option.conditionNodeIds].sort((a, b) => a - b).join(',') ===
                  [...ids].sort((a, b) => a - b).join(',');
              const price = quoted(option.salePriceVnd);
              return (
                <button
                  key={option.productId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ conditionNodeIds: option.conditionNodeIds, otherCondition: '' })}
                >
                  <span>{label(option)}</span>
                  <strong>
                    {price !== null ? formatVND(price, locale) : en ? 'Inspection quote' : 'Báo giá riêng'}
                  </strong>
                  {active && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
          {available.length > 4 && (
            <button type="button" className="service-condition-link" onClick={() => setMore(!more)}>
              {more ? (en ? 'Show less' : 'Thu gọn') : en ? 'All combinations' : 'Xem tất cả tổ hợp'}
            </button>
          )}
        </section>
      )}
      <details className="service-condition-custom">
        <summary>
          {en ? 'Choose other conditions' : 'Chọn tình trạng khác'}{' '}
          <span>{ids.length ? `${ids.length} ${en ? 'selected' : 'đã chọn'}` : en ? 'Optional' : 'Tùy chọn'}</span>
        </summary>
        <p className="service-condition-hint">
          {en
            ? 'Choose several issues. Details appear only when relevant. Conflicting choices replace each other.'
            : 'Có thể chọn nhiều lỗi. Chi tiết chỉ hiện khi cần; lựa chọn loại trừ sẽ tự thay thế nhau.'}
        </p>
        {tree.loading ? (
          <p role="status">{en ? 'Loading…' : 'Đang tải…'}</p>
        ) : tree.failed ? (
          <button type="button" onClick={tree.reload}>
            {en ? 'Retry' : 'Thử lại'}
          </button>
        ) : (
          <ConditionDropdowns
            nodes={tree.nodes}
            value={ids}
            itemType={type}
            onChange={(conditionNodeIds) => onChange({ conditionNodeIds })}
          />
        )}
      </details>
      <details className="service-condition-other" open={other.trim() ? true : undefined}>
        <summary>{en ? 'Something else to disclose?' : 'Có tình trạng chưa được liệt kê?'}</summary>
        <TextAreaField
          name="otherCondition"
          label={en ? 'Other condition' : 'Tình trạng khác'}
          placeholder={
            en
              ? 'Describe it for an individual quote after inspection.'
              : 'Mô tả để shop báo giá riêng sau khi nhận và kiểm hàng.'
          }
          rows={2}
          maxLength={2000}
          value={other}
          onChange={(event) => onChange({ otherCondition: event.target.value })}
        />
      </details>
      <p className={`service-condition-notice ${!matching && !match?.approvedAt ? 'is-manual' : ''}`} role="status">
        {matching
          ? en
            ? 'Checking the exact combination…'
            : 'Đang đối chiếu đúng tổ hợp…'
          : failed
            ? en
              ? 'Reference unavailable. The shop will confirm after inspection.'
              : 'Chưa tải được giá tham khảo. Shop sẽ xác nhận sau kiểm hàng.'
            : match?.approvedAt
              ? en
                ? 'Reference estimate only; final price follows inspection.'
                : 'Giá dự kiến cho đúng tổ hợp; giá cuối xác nhận sau kiểm hàng.'
              : en
                ? 'This combination has no approved price. The shop will quote separately after receiving and inspecting the item.'
                : 'Tổ hợp này chưa có giá được duyệt. Shop sẽ báo giá riêng sau khi nhận và kiểm hàng.'}
      </p>
    </div>
  );
}
