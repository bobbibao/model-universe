'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Api from '@/core/client/api/Api';
import type { ProductSummary } from '@/shared/types/product';
import CatalogCombobox from './CatalogCombobox';
import ConditionFields, {
  NameField,
  NEW_CONDITION_VALUE,
  useConditionPayload,
  type ConditionValue,
} from './ConditionFields';
import EvidenceUploader, { type UploadedEvidence } from './EvidenceUploader';

export const COLLECTIBLE_ASSET_FIELDS = [
  'name',
  'modelCode',
  'version',
  'assemblyState',
  'boxCondition',
  'accessories',
  'defects',
  'repairHistory',
] as const;

// A pawn request in one short form: the catalogue model (or its name), its condition as choices with one note when it
// is not new, and at least three real photos. `initialReference`: the model valued in QuickValuation; the server quotes
// C50 again from its S, only for a unit declared new.
export default function CollectibleSubmissionForm({
  purpose,
  onCreated,
  initialReference = null,
}: {
  purpose: 'buyback' | 'pawn';
  onCreated: (id: number) => Promise<void>;
  initialReference?: ProductSummary | null;
}) {
  const v2 = useTranslations('buybackV2'),
    form = useTranslations('itemCondition'),
    common = useTranslations('common');
  const [reference, setReference] = useState<ProductSummary | null>(initialReference);
  const [condition, setCondition] = useState<ConditionValue>(NEW_CONDITION_VALUE);
  const [files, setFiles] = useState<UploadedEvidence[]>([]);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ digest: string; key: string } | undefined>(undefined);
  const payload = useConditionPayload();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    const { asset, isNew } = payload(condition, reference);
    const data = {
      asset,
      evidenceIds: files.map((file) => file.id),
      ...(reference ? { referenceProductId: reference.id, issuesDeclared: !isNew } : {}),
    };
    const digest = JSON.stringify(data);
    if (pending.current?.digest !== digest) pending.current = { digest, key: crypto.randomUUID() };
    setBusy(true);
    try {
      const saved = (await Api.post(`/${purpose}`, { ...data, requestKey: pending.current.key })).data;
      await onCreated(saved.id);
    } catch {
      /* Preserve the exact submission key after an uncertain response. */
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="service-form">
      <section className="service-form-section">
        <CatalogCombobox label={v2('catalogSearch')} value={reference} onChange={setReference} />
        {!reference && <p className="service-form-hint">{v2('catalogHint')}</p>}
        {!reference && <NameField value={condition} onChange={setCondition} />}
      </section>
      <section className="service-form-section">
        <h3>{form('conditionTitle')}</h3>
        <ConditionFields value={condition} onChange={setCondition} reference={reference} />
      </section>
      <section className="service-form-section">
        <EvidenceUploader purpose={purpose} files={files} onFiles={setFiles} onBusy={setBusy} />
      </section>
      <section className="service-form-section service-form-submit">
        <button type="submit" className="mu-button" disabled={busy || files.length < 3}>
          {common('submit')}
        </button>
      </section>
    </form>
  );
}
