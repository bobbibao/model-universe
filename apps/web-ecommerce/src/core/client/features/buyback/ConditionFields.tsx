'use client';

import { useTranslations } from 'next-intl';
import {
  ITEM_CONDITION_CHOICES,
  NEW_ITEM_CONDITION,
  conditionIssues,
  type ItemCondition,
} from '@/shared/item-condition';
import type { BuybackAsset } from '@/shared/types/buyback';
import type { BuybackIssue } from '@/shared/buyback-pricing';
import './service-form.css';

export interface ConditionValue {
  // Only without a catalogue model: what the customer calls the model.
  name: string;
  condition: ItemCondition;
  note: string;
}

export const NEW_CONDITION_VALUE: ConditionValue = { name: '', condition: NEW_ITEM_CONDITION, note: '' };

type Group = keyof typeof ITEM_CONDITION_CHOICES;

// The asset fields a buyback or pawn request records, in the order staff read them.
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

// The condition of a unit that is neither new nor a plain 2hand ("Khác"): choices (chips) and one required note.
export default function ConditionFields({
  value,
  onChange,
  reference,
}: {
  value: ConditionValue;
  onChange: (value: ConditionValue) => void;
  reference: { name: string } | null;
}) {
  const t = useTranslations('itemCondition'),
    catalog = useTranslations('catalog');
  const groups: Group[] = reference
    ? ['assemblyState', 'box', 'accessories', 'defects', 'history']
    : ['version', 'assemblyState', 'box', 'accessories', 'defects', 'history'];
  const label = (group: Group, option: string) =>
    group === 'assemblyState' ? catalog(option) : t(`options.${group}.${option}`);
  return (
    <div className="item-condition">
      <div className="item-condition-groups">
        {groups.map((group) => (
          <fieldset key={group} className="item-condition-group">
            <legend>{t(`groups.${group}`)}</legend>
            <div className="item-condition-chips">
              {ITEM_CONDITION_CHOICES[group].map((option) => (
                <label key={option} className="item-condition-chip">
                  <input
                    type="radio"
                    name={`condition-${group}`}
                    checked={value.condition[group] === option}
                    onChange={() => onChange({ ...value, condition: { ...value.condition, [group]: option } })}
                  />
                  <span>{label(group, option)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <label className="mu-field">
        {t('noteRequired')}
        <textarea
          name="note"
          rows={2}
          maxLength={1000}
          required
          value={value.note}
          placeholder={t('notePlaceholder')}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
        />
      </label>
    </div>
  );
}

// The request fields the server expects (the asset texts, the declared issues and serious damage), in the customer's
// language, from the chosen options.
export function useConditionPayload() {
  const t = useTranslations('itemCondition'),
    catalog = useTranslations('catalog');
  return (value: ConditionValue, reference: { name: string; modelCode?: string | null } | null) => {
    const { condition } = value;
    const note = value.note.trim();
    const option = (group: Exclude<Group, 'assemblyState'>) => t(`options.${group}.${condition[group]}`);
    const withNote = (text: string, applies: boolean) => (applies && note ? `${text}. ${note}` : text);
    const name = reference?.name ?? value.name.trim();
    const asset: BuybackAsset = {
      name,
      modelCode: reference?.modelCode || name,
      version: reference ? t('sameModel') : option('version'),
      assemblyState: condition.assemblyState,
      boxCondition: option('box'),
      accessories: withNote(option('accessories'), condition.accessories !== 'complete'),
      defects: withNote(option('defects'), true),
      repairHistory: option('history'),
    };
    const issues: BuybackIssue[] = conditionIssues(condition, (what) => {
      const [group, choice] = what.split(':');
      const text = group === 'assembly' ? catalog(choice) : t(`options.history.${choice}`);
      return (note ? `${text}. ${note}` : text).slice(0, 500);
    });
    // A unit described here is always priced by the shop: with no issue among the choices, the note is the issue.
    if (!issues.length && condition.defects !== 'serious')
      issues.push({ type: 'other', quantity: 1, description: (note || t('noteRequired')).slice(0, 500) });
    return { asset, issues, seriousDamage: condition.defects === 'serious' };
  };
}
