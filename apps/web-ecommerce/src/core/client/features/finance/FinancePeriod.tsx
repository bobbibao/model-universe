'use client';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import TextField from '@/components/FormElements/TextField';
import { shopDay } from '@/shared/finance';
export type FinanceRange = { from: string; to: string };
export const currentFinanceRange = (): FinanceRange => {
  const today = shopDay(new Date());
  return { from: `${today.slice(0, 7)}-01`, to: today };
};
export default function FinancePeriod({
  range,
  onChange,
  loading = false,
}: {
  range: FinanceRange;
  onChange: (range: FinanceRange) => void;
  loading?: boolean;
}) {
  const en = useLocale() === 'en',
    [draft, setDraft] = useState(range);
  return (
    <form
      className="finance-period"
      onSubmit={(e) => {
        e.preventDefault();
        onChange({ ...draft });
      }}
    >
      <div className="finance-presets">
        {[0, 30, 90].map((days) => (
          <button
            type="button"
            key={days}
            onClick={() => {
              const today = shopDay(new Date());
              const next = {
                from: days
                  ? new Date(Date.parse(today) - (days - 1) * 86400000).toISOString().slice(0, 10)
                  : `${today.slice(0, 7)}-01`,
                to: today,
              };
              setDraft(next);
              onChange(next);
            }}
          >
            {days ? `${days} ${en ? 'days' : 'ngày'}` : en ? 'This month' : 'Tháng này'}
          </button>
        ))}
      </div>
      <TextField
        label={en ? 'From' : 'Từ ngày'}
        type="date"
        required
        value={draft.from}
        max={draft.to}
        onChange={(e) => setDraft({ ...draft, from: e.target.value })}
      />
      <TextField
        label={en ? 'To' : 'Đến ngày'}
        type="date"
        required
        value={draft.to}
        min={draft.from}
        onChange={(e) => setDraft({ ...draft, to: e.target.value })}
      />
      <button className="finance-button" disabled={loading}>
        {en ? 'Apply' : 'Áp dụng'}
      </button>
      <span className="finance-caption">GMT+7 · VND</span>
    </form>
  );
}
