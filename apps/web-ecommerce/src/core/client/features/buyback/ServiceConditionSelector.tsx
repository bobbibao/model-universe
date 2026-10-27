'use client';
import { useEffect, useId, useRef, useState } from 'react';
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
import ServiceIcon from './ServiceIcon';

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
  onMatch: (snapshot: ConditionCaseSnapshot | null | undefined) => void;
}) {
  const locale = useLocale(),
    en = locale === 'en';
  const tree = useConditionTree();
  const id = useId();
  const notePanel = useRef<HTMLDivElement>(null);
  const callback = useRef(onMatch);
  callback.current = onMatch;
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [matching, setMatching] = useState(true),
    [failed, setFailed] = useState(false);
  const [match, setMatch] = useState<ConditionCaseSnapshot | null>(null);
  const [more, setMore] = useState(false);
  const [panel, setPanel] = useState<'conditions' | 'note' | null>(other.trim() ? 'note' : null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (panel === 'note') notePanel.current?.querySelector('textarea')?.focus({ preventScroll: true });
  }, [panel]);
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
    callback.current(undefined);
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
  }, [familyId, type, selected, other, retry]);
  const available = combinations.filter((option) => option.itemTypeKey === type);
  const canChooseConditions =
    tree.loading ||
    tree.failed ||
    tree.nodes.some((node) => node.isActive && node.selectable && node.itemTypes.includes(type));
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
      <div className="service-condition-top">
        <span>{en ? 'Item type' : 'Loại hàng'}</span>
        <div
          className="sb-segment"
          role="radiogroup"
          aria-label={en ? 'Item type' : 'Loại hàng'}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next =
              event.key === 'Home' ? 'new' : event.key === 'End' ? 'preowned' : type === 'new' ? 'preowned' : 'new';
            if (next !== type) onChange({ condition: next, conditionNodeIds: [] });
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next === 'new' ? 0 : 1]?.focus();
          }}
        >
          {(['new', 'preowned'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              tabIndex={type === value ? 0 : -1}
              onClick={() => value !== type && onChange({ condition: value, conditionNodeIds: [] })}
            >
              {value === 'new' ? 'New' : '2hand'}
            </button>
          ))}
        </div>
      </div>
      {!!available.length && (
        <section
          className="service-combinations"
          aria-label={en ? 'Combinations with a reference price' : 'Tổ hợp có báo giá'}
        >
          <div className="service-combinations-heading">
            <span>{en ? 'Choose a condition with an estimate' : 'Chọn tình trạng có giá tham khảo'}</span>
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
                  onClick={() => {
                    onChange({ conditionNodeIds: option.conditionNodeIds, otherCondition: '' });
                    setPanel(null);
                  }}
                >
                  <span className="service-combination-check">
                    <ServiceIcon name="check" size={12} />
                  </span>
                  <span className="service-combination-label">{label(option)}</span>
                  <strong>
                    {price !== null ? formatVND(price, locale) : en ? 'Inspection quote' : 'Báo giá riêng'}
                  </strong>
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
      <div className="service-condition-tools">
        {canChooseConditions && (
          <button
            type="button"
            aria-expanded={panel === 'conditions'}
            aria-controls={`${id}-conditions`}
            onClick={() => setPanel(panel === 'conditions' ? null : 'conditions')}
          >
            <ServiceIcon name="sliders" size={15} />
            <span>{en ? 'Conditions' : 'Tình trạng'}</span>
            {!!ids.length && (
              <span className="service-tool-count">
                {ids.length} {en ? 'selected' : 'mục'}
              </span>
            )}
            <ServiceIcon name="chevron" size={13} />
          </button>
        )}
        <button
          type="button"
          aria-expanded={panel === 'note'}
          aria-controls={`${id}-note`}
          onClick={() => setPanel(panel === 'note' ? null : 'note')}
        >
          <ServiceIcon name="edit" size={15} />
          {en ? 'Add a note' : 'Mô tả thêm'}
          {!!other.trim() && (
            <span className="service-tool-count">
              <ServiceIcon name="check" size={11} />
            </span>
          )}
          <ServiceIcon name="chevron" size={13} />
        </button>
      </div>
      <section
        className="service-condition-custom"
        id={`${id}-conditions`}
        hidden={panel !== 'conditions' || !canChooseConditions}
        aria-label={en ? 'Choose conditions' : 'Tự chọn tình trạng'}
      >
        <div className="service-condition-panel-heading">
          <strong>{en ? 'What should the shop know about this model?' : 'Mô hình có điểm nào cần lưu ý?'}</strong>
          {!!ids.length && (
            <button type="button" onClick={() => onChange({ conditionNodeIds: [] })}>
              {en ? 'Clear all' : 'Bỏ chọn tất cả'}
            </button>
          )}
        </div>
        <p className="service-condition-hint">
          {en
            ? 'Choose all that apply. Close a group to collapse it; your selections are kept.'
            : 'Chọn các mục phù hợp. Bấm Đóng để thu gọn nhóm; lựa chọn vẫn được giữ.'}
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
      </section>
      <div className="service-condition-other" id={`${id}-note`} hidden={panel !== 'note'} ref={notePanel}>
        <TextAreaField
          name="otherCondition"
          label={en ? 'Anything else the shop should know?' : 'Điều shop cần biết thêm'}
          placeholder={
            en
              ? 'e.g. missing the left shield, repaired knee joint…'
              : 'VD: thiếu khiên trái, khớp gối đã sửa, trầy ở vai…'
          }
          rows={2}
          maxLength={2000}
          value={other}
          onChange={(event) => onChange({ otherCondition: event.target.value })}
          hint={
            en
              ? 'Optional. This item will receive an individual quote after inspection.'
              : 'Không bắt buộc. Shop sẽ xem mô tả và báo giá riêng sau kiểm hàng.'
          }
        />
      </div>
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
                ? 'Estimate only · confirmed after inspection.'
                : 'Giá tham khảo · xác nhận sau kiểm hàng.'
              : en
                ? 'Individual quote · the shop will confirm after receiving and inspecting the item.'
                : 'Báo giá riêng · shop xác nhận sau khi nhận và kiểm hàng.'}
        {failed && (
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {en ? 'Retry' : 'Thử lại'}
          </button>
        )}
      </p>
    </div>
  );
}
