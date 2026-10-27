'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import Api from '@/core/client/api/Api';
import { conditionSelected } from '@/shared/condition-selection';
import { useConditionTree } from '@/shared/client/hooks/useConditionTree';
import { ancestors, conditionPath, nodeLabel, type ConditionNode, type ItemTypeKey } from '@/shared/condition-tree';
import TextField from '@/components/FormElements/TextField';
import SelectField from '@/components/FormElements/SelectField';
import Modal from '@/components/Modal/Modal';
import ConditionTreeChevron from '@/components/Store/ConditionTreeChevron';

type Draft = Pick<
  ConditionNode,
  | 'parentId'
  | 'nameVi'
  | 'nameEn'
  | 'description'
  | 'selectable'
  | 'selectionMode'
  | 'itemTypes'
  | 'sortOrder'
  | 'isActive'
>;
const empty: Draft = {
  parentId: null,
  nameVi: '',
  nameEn: '',
  description: '',
  selectable: true,
  selectionMode: 'multiple',
  itemTypes: ['preowned'],
  sortOrder: 0,
  isActive: true,
};
export default function ProductConditionList() {
  const en = useLocale() === 'en';
  const tree = useConditionTree(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const initialized = useRef(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = tree.nodes.find((node) => node.id === selectedId);
  const [draft, setDraft] = useState<Draft>(empty);
  const [query, setQuery] = useState('');
  const [showRetired, setShowRetired] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (tree.nodes.length && !initialized.current) {
      setCollapsed(new Set(tree.nodes.map((node) => node.id)));
      initialized.current = true;
    }
  }, [tree.nodes]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'save' | 'delete' | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const edit = (node?: ConditionNode, parentId?: number | null) => {
    setSelectedId(node?.id ?? null);
    setDraft(node ? { ...node } : { ...empty, parentId: parentId ?? null, sortOrder: tree.nodes.length * 10 });
    setMessage('');
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const rows = useMemo(() => {
    const visibleNodes = tree.nodes.filter((node) => showRetired || node.isActive);
    const walk = (parentId: number | null, depth: number): { node: ConditionNode; depth: number }[] =>
      visibleNodes
        .filter((node) => node.parentId === parentId)
        .flatMap((node) => [{ node, depth }, ...(collapsed.has(node.id) ? [] : walk(node.id, depth + 1))]);
    return query.trim()
      ? visibleNodes
          .filter((node) =>
            conditionPath(node.id, tree.nodes, en).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
          )
          .map((node) => ({ node, depth: 0 }))
      : walk(null, 0);
  }, [tree.nodes, collapsed, query, en, showRetired]);
  const save = async (confirmed = false) => {
    if (
      selected &&
      (selected.productCount ?? 0) > 0 &&
      (draft.parentId !== selected.parentId || draft.isActive !== selected.isActive) &&
      !confirmed
    ) {
      setConfirm('save');
      return;
    }
    setBusy(true);
    try {
      const payload = { ...draft, expectedVersion: selected?.version, confirmImpact: confirmed };
      const response = selected
        ? await Api.put(`/admin/product-condition-tree/${selected.id}`, payload)
        : await Api.post('/admin/product-condition-tree', payload);
      setSelectedId(response.data.id);
      setSelectedIds((current) => new Set([...current, response.data.id]));
      setDraft(response.data);
      setMessage(en ? 'Saved' : 'Đã lưu');
      tree.reload();
      setConfirm(null);
    } catch {
      /* API displays the server validation, draft remains intact. */
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await Api.delete(`/admin/product-condition-tree/${selected.id}`, { data: { expectedVersion: selected.version } });
      setSelectedIds((current) => new Set([...current].filter((id) => id !== selected.id)));
      edit();
      tree.reload();
      setConfirm(null);
    } catch {
      /* The shared API displays validation; keep the draft for retry. */
    } finally {
      setBusy(false);
    }
  };
  const parents = tree.nodes.filter(
    (node) => node.id !== selectedId && (!selectedId || !ancestors(node.id, tree.nodes).includes(selectedId)),
  );
  return (
    <div className="catalog-tree-workspace">
      <div className="catalog-section-toolbar">
        <div>
          <h1>{en ? 'Condition library' : 'Cây tình trạng'}</h1>
          <p>
            {en ? 'Shared across products, buyback, trade and pawn.' : 'Dùng chung cho sản phẩm, thu, trade và cầm.'}
          </p>
        </div>
        <button
          className="mu-button"
          type="button"
          onClick={() => {
            setSelectedIds(new Set());
            edit();
          }}
        >
          {en ? '+ Add root' : '+ Thêm nhánh gốc'}
        </button>
      </div>
      <div className="catalog-tree-admin">
        <aside className="catalog-tree-browser" aria-label={en ? 'Condition library' : 'Thư viện tình trạng'}>
          <input
            className="catalog-tree-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={en ? 'Find a branch…' : 'Tìm nhánh tình trạng…'}
            aria-label={en ? 'Search conditions' : 'Tìm tình trạng'}
          />
          {tree.loading && (
            <p role="status" className="condition-tree-empty">
              {en ? 'Loading…' : 'Đang tải…'}
            </p>
          )}
          {tree.failed && (
            <button type="button" className="condition-tree-empty" onClick={tree.reload}>
              {en ? 'Retry' : 'Thử lại'}
            </button>
          )}
          <div className="catalog-tree-selection-bar">
            <button type="button" aria-pressed={showRetired} onClick={() => setShowRetired((current) => !current)}>
              {showRetired ? (en ? 'Hide retired branches' : 'Ẩn nhánh ngừng dùng') : (en ? 'Show retired branches' : 'Hiện nhánh ngừng dùng')}
            </button>
            <span>
              {selectedIds.size
                ? `${selectedIds.size} ${en ? 'selected · edit one at a time' : 'nhánh đã chọn · sửa từng nhánh'}`
                : en
                  ? 'Select a branch to edit'
                  : 'Chọn nhánh để chỉnh sửa'}
            </span>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set());
                  edit();
                }}
              >
                {en ? 'Clear' : 'Bỏ chọn'}
              </button>
            )}
          </div>
          <div className="catalog-tree-definition-rows">
            {rows.map(({ node, depth }) => (
              <div
                key={node.id}
                draggable={!busy}
                onDragStart={() => setDragId(node.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const dragged = tree.nodes.find((item) => item.id === dragId);
                  if (!dragged || dragged.id === node.id || ancestors(node.id, tree.nodes).includes(dragged.id)) return;
                  // Drop in the top third (or Shift-drop) to sort before a sibling; elsewhere creates a child.
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const before = event.shiftKey || event.clientY < bounds.top + bounds.height / 3;
                  edit(dragged);
                  setDraft({
                    ...dragged,
                    parentId: before ? node.parentId : node.id,
                    sortOrder: before
                      ? node.sortOrder - 1
                      : tree.nodes
                          .filter((item) => item.parentId === node.id)
                          .reduce((max, item) => Math.max(max, item.sortOrder + 10), 0),
                  });
                  setMessage(
                    before
                      ? en
                        ? `Review sorting before ${nodeLabel(node, en)} and save.`
                        : `Kiểm tra thứ tự trước ${nodeLabel(node, en)} rồi lưu.`
                      : en
                        ? 'Review the destination and save the move.'
                        : 'Kiểm tra nhánh đích và bấm lưu để di chuyển.',
                  );
                  setDragId(null);
                }}
                className={`catalog-tree-definition-row${conditionSelected(node.id, [...selectedIds], tree.nodes) ? ' is-active' : ''}${selectedId === node.id ? ' is-editing' : ''}${!node.isActive ? ' is-retired' : ''}`}
                style={{ paddingInlineStart: `${8 + Math.min(depth, 8) * 16}px` }}
              >
                {tree.nodes.some((item) => item.parentId === node.id) ? (
                  <button
                    type="button"
                    className="condition-tree-expand"
                    aria-label={`${en ? 'Expand' : 'Mở nhánh'} ${nodeLabel(node, en)}`}
                    aria-expanded={!collapsed.has(node.id)}
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(node.id)) next.delete(node.id);
                        else next.add(node.id);
                        return next;
                      })
                    }
                  >
                    <ConditionTreeChevron />
                  </button>
                ) : (
                  <span className="condition-tree-expand" />
                )}
                <button
                  type="button"
                  className="catalog-tree-node"
                  aria-current={selectedId === node.id ? 'true' : undefined}
                  aria-pressed={conditionSelected(node.id, [...selectedIds], tree.nodes)}
                  onClick={() => {
                    const checked = conditionSelected(node.id, [...selectedIds], tree.nodes);
                    const next = new Set(
                      [...selectedIds].filter(
                        (id) => !checked || (id !== node.id && !ancestors(id, tree.nodes).includes(node.id)),
                      ),
                    );
                    if (!checked) {
                      ancestors(node.id, tree.nodes).forEach((id) => next.delete(id));
                      next.add(node.id);
                    }
                    setSelectedIds(next);
                    if (!checked) edit(node);
                    else if (selectedId === node.id)
                      edit(tree.nodes.find((item) => item.id === [...next].slice(-1)[0]));
                  }}
                >
                  <span>{query ? conditionPath(node.id, tree.nodes, en) : nodeLabel(node, en)}</span>
                  <small>{node.productCount ? node.productCount : ''}</small>
                  <span className="catalog-tree-tick" aria-hidden="true">
                    {conditionSelected(node.id, [...selectedIds], tree.nodes) ? '✓' : ''}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </aside>
        <form
          className="catalog-tree-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="catalog-section-toolbar">
            <h2>{selected ? nodeLabel(selected, en) : en ? 'New branch' : 'Nhánh mới'}</h2>
            {selected && (
              <button type="button" className="catalog-child-action" onClick={() => edit(undefined, selected.id)}>
                {en ? 'Add child' : 'Thêm nhánh con'}
              </button>
            )}
          </div>
          {selectedIds.size > 1 && (
            <div className="catalog-tree-review-selection">
              {[...selectedIds].map((id) => {
                const node = tree.nodes.find((row) => row.id === id);
                return node ? (
                  <button type="button" key={id} aria-pressed={selectedId === id} onClick={() => edit(node)}>
                    {nodeLabel(node, en)}
                  </button>
                ) : null;
              })}
            </div>
          )}
          <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
            <TextField
              name="nameVi"
              label={en ? 'Vietnamese label' : 'Tên tiếng Việt'}
              required
              maxLength={120}
              value={draft.nameVi}
              onChange={(event) => set('nameVi', event.target.value)}
            />
            <TextField
              name="nameEn"
              label={en ? 'English label' : 'Tên tiếng Anh'}
              maxLength={120}
              value={draft.nameEn}
              onChange={(event) => set('nameEn', event.target.value)}
            />
            <SelectField
              name="parentId"
              label={en ? 'Parent branch / move to' : 'Nhánh cha / di chuyển đến'}
              value={String(draft.parentId ?? '')}
              placeholder={en ? 'Root branch' : 'Nhánh gốc'}
              options={parents.map((node) => ({
                value: String(node.id),
                label: conditionPath(node.id, tree.nodes, en),
              }))}
              onChange={(event) => set('parentId', event.target.value ? Number(event.target.value) : null)}
            />
            <TextField
              name="sortOrder"
              label={en ? 'Display order' : 'Thứ tự hiển thị'}
              type="number"
              min={-2147483648}
              max={2147483647}
              step={1}
              value={draft.sortOrder}
              onChange={(event) => set('sortOrder', Number(event.target.value))}
            />
            <SelectField
              name="selectable"
              label={en ? 'Branch purpose' : 'Vai trò của nhánh'}
              value={draft.selectable ? 'condition' : 'group'}
              options={[
                { value: 'group', label: en ? 'Group · organize branches' : 'Nhóm · gom các nhánh' },
                { value: 'condition', label: en ? 'Condition · can be selected' : 'Tình trạng · được chọn' },
              ]}
              onChange={(event) => set('selectable', event.target.value === 'condition')}
            />
            <SelectField
              name="selectionMode"
              label={en ? 'Child selection' : 'Quy tắc chọn nhánh con'}
              value={draft.selectionMode}
              options={[
                { value: 'multiple', label: en ? 'Multiple branches' : 'Chọn nhiều nhánh' },
                { value: 'single', label: en ? 'One branch only' : 'Chỉ chọn một nhánh' },
              ]}
              onChange={(event) => set('selectionMode', event.target.value as Draft['selectionMode'])}
            />
            <div>
              <p className="mb-2 text-sm font-medium">{en ? 'Applies to' : 'Loại hàng áp dụng'}</p>
              <div className="flex gap-5">
                {(['new', 'preowned'] as ItemTypeKey[]).map((type) => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.itemTypes.includes(type)}
                      onChange={(event) =>
                        set(
                          'itemTypes',
                          event.target.checked
                            ? [...draft.itemTypes, type]
                            : draft.itemTypes.filter((item) => item !== type),
                        )
                      }
                    />
                    {type === 'new' ? 'New' : '2hand'}
                  </label>
                ))}
              </div>
            </div>
            <SelectField
              name="isActive"
              label={en ? 'Availability' : 'Sử dụng'}
              value={draft.isActive ? 'active' : 'inactive'}
              options={[
                { value: 'active', label: en ? 'Available for new selections' : 'Cho phép chọn mới' },
                { value: 'inactive', label: en ? 'Retired · retain history' : 'Ngừng dùng · giữ lịch sử' },
              ]}
              onChange={(event) => set('isActive', event.target.value === 'active')}
            />
          </fieldset>
          <div className="catalog-tree-editor-footer">
            <span role="status">
              {message ||
                (selected
                  ? `${selected.productCount ?? 0} ${en ? 'products use this branch' : 'sản phẩm dùng nhánh này'}`
                  : '')}
            </span>
            {selected && (
              <button
                type="button"
                disabled={busy}
                className="catalog-danger-link"
                onClick={() => setConfirm('delete')}
              >
                {en ? 'Delete unused branch' : 'Xóa nhánh chưa dùng'}
              </button>
            )}
            <button className="mu-button" disabled={busy} type="submit">
              {busy ? '…' : en ? 'Save branch' : 'Lưu nhánh'}
            </button>
          </div>
          <p className="catalog-form-note">
            {en
              ? 'New / 2hand is an independent item attribute. Moving a branch keeps product identities and historical snapshots.'
              : 'New / 2hand là thuộc tính riêng của sản phẩm. Di chuyển nhánh giữ nguyên tổ hợp sản phẩm và snapshot lịch sử.'}
          </p>
          <Link href="/admin/products">{en ? 'Back to products' : 'Về danh sách sản phẩm'} →</Link>
        </form>
      </div>
      <Modal
        open={!!confirm}
        title={
          confirm === 'delete'
            ? en
              ? 'Delete branch'
              : 'Xóa nhánh'
            : en
              ? 'Review affected products'
              : 'Xác nhận ảnh hưởng'
        }
        onClose={() => {
          if (!busy) setConfirm(null);
        }}
        footer={
          <>
            <button
              type="button"
              disabled={busy}
              className="mu-button mu-button-secondary"
              onClick={() => setConfirm(null)}
            >
              {en ? 'Cancel' : 'Hủy'}
            </button>
            <button
              type="button"
              disabled={busy}
              className="mu-button"
              onClick={() => (confirm === 'delete' ? void remove() : void save(true))}
            >
              {en ? 'Confirm' : 'Xác nhận'}
            </button>
          </>
        }
      >
        <p>
          {confirm === 'delete'
            ? en
              ? 'Only a branch without products, history or children can be deleted. Retire used branches instead.'
              : 'Chỉ xóa nhánh chưa có sản phẩm, lịch sử hoặc nhánh con. Nhánh đã dùng cần ngừng dùng để giữ lịch sử.'
            : `${selected?.productCount ?? 0} ${en ? 'products are affected by this branch. Their selections are retained; historical requests keep their snapshots.' : 'sản phẩm đang dùng nhánh này. Giữ nguyên lựa chọn của sản phẩm; yêu cầu cũ giữ snapshot đã chốt.'}`}
        </p>
      </Modal>
    </div>
  );
}
